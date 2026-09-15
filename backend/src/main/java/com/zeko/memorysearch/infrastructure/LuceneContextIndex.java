package com.zeko.memorysearch.infrastructure;

import com.zeko.memorysearch.application.ContextIndex;
import com.zeko.memorysearch.application.MemoryAccessContext;
import com.zeko.memorysearch.domain.MemoryEntry;
import com.zeko.memorysearch.domain.MemoryScope;
import com.zeko.sharedkernel.domain.DomainError;
import com.zeko.sharedkernel.domain.ResourceId;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import org.apache.lucene.analysis.standard.StandardAnalyzer;
import org.apache.lucene.document.Document;
import org.apache.lucene.document.Field.Store;
import org.apache.lucene.document.StringField;
import org.apache.lucene.document.TextField;
import org.apache.lucene.index.DirectoryReader;
import org.apache.lucene.index.IndexWriter;
import org.apache.lucene.index.IndexWriterConfig;
import org.apache.lucene.index.IndexWriterConfig.OpenMode;
import org.apache.lucene.index.Term;
import org.apache.lucene.search.BooleanClause.Occur;
import org.apache.lucene.search.BooleanQuery;
import org.apache.lucene.search.IndexSearcher;
import org.apache.lucene.search.MatchAllDocsQuery;
import org.apache.lucene.search.Query;
import org.apache.lucene.search.TermQuery;
import org.apache.lucene.store.Directory;
import org.apache.lucene.store.FSDirectory;
import org.apache.lucene.util.QueryBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class LuceneContextIndex implements ContextIndex {
  private static final String CONTENT = "content";
  private static final String ID = "id";
  private static final String OWNER = "owner";
  private static final String PROJECT = "project";
  private static final String SCOPE = "scope";
  private static final String SOURCE = "source";
  private static final String INDEX_STATE = "indexState";
  private static final int MAX_RESULTS = 25;

  private final Path indexRoot;

  @Autowired
  public LuceneContextIndex(
      @Value("${zeko.memory.index-root:}") String configuredRoot) {
    this(indexRoot(configuredRoot));
  }

  public LuceneContextIndex(Path indexRoot) {
    this.indexRoot = Objects.requireNonNull(indexRoot)
        .toAbsolutePath().normalize();
  }

  @Override
  public synchronized void index(MemoryEntry entry, String content) {
    Objects.requireNonNull(entry, "La entrada de memoria es obligatoria");
    try (Directory directory = openDirectory();
         StandardAnalyzer analyzer = new StandardAnalyzer();
         IndexWriter writer = new IndexWriter(directory,
             new IndexWriterConfig(analyzer))) {
      Term identity = new Term(ID, entry.id().asString());
      if (entry.sensitive() || entry.indexState() != MemoryEntry.IndexState.CURRENT) {
        writer.deleteDocuments(identity);
      } else {
        writer.updateDocument(identity, document(entry, content));
      }
      writer.commit();
    } catch (IOException failure) {
      throw unavailable(failure);
    }
  }

  @Override
  public synchronized void rebuild(List<IndexedEntry> entries) {
    Objects.requireNonNull(entries, "Las entradas de memoria son obligatorias");
    try (Directory directory = openDirectory();
         StandardAnalyzer analyzer = new StandardAnalyzer();
         IndexWriter writer = new IndexWriter(directory,
             new IndexWriterConfig(analyzer).setOpenMode(OpenMode.CREATE))) {
      for (IndexedEntry candidate : entries) {
        if (candidate == null || candidate.entry() == null) {
          continue;
        }
        MemoryEntry entry = candidate.entry();
        if (!entry.sensitive() && entry.indexState() == MemoryEntry.IndexState.CURRENT) {
          writer.addDocument(document(entry, candidate.content()));
        }
      }
      writer.commit();
    } catch (IOException failure) {
      throw unavailable(failure);
    }
  }

  @Override
  public List<Result> search(ResourceId projectId, ResourceId ownerId,
                             String query) {
    Objects.requireNonNull(projectId, "El proyecto es obligatorio");
    Objects.requireNonNull(ownerId, "El propietario es obligatorio");
    try (Directory directory = openDirectory()) {
      if (!DirectoryReader.indexExists(directory)) {
        return List.of();
      }
      try (DirectoryReader reader = DirectoryReader.open(directory);
           StandardAnalyzer analyzer = new StandardAnalyzer()) {
        IndexSearcher searcher = new IndexSearcher(reader);
        var hits = searcher.search(scopedQuery(projectId, ownerId, query, analyzer),
                                   MAX_RESULTS).scoreDocs;
        return Arrays.stream(hits)
            .map(hit -> document(searcher, hit.doc))
            .toList();
      }
    } catch (IOException failure) {
      throw unavailable(failure);
    }
  }

  @Override
  public List<Result> search(MemoryAccessContext context, String query) {
    Objects.requireNonNull(context, "El contexto de memoria es obligatorio");
    try (Directory directory = openDirectory()) {
      if (!DirectoryReader.indexExists(directory)) {
        return List.of();
      }
      try (DirectoryReader reader = DirectoryReader.open(directory);
           StandardAnalyzer analyzer = new StandardAnalyzer()) {
        IndexSearcher searcher = new IndexSearcher(reader);
        var hits = searcher.search(scopedQuery(context, query, analyzer),
                                   MAX_RESULTS).scoreDocs;
        return Arrays.stream(hits).map(hit -> document(searcher, hit.doc)).toList();
      }
    } catch (IOException failure) {
      throw unavailable(failure);
    }
  }

  private Directory openDirectory() throws IOException {
    Files.createDirectories(indexRoot);
    return FSDirectory.open(indexRoot);
  }

  private static Document document(MemoryEntry entry, String content) {
    Document document = new Document();
    document.add(new StringField(ID, entry.id().asString(), Store.YES));
    document.add(new StringField(SCOPE, entry.scope().name(), Store.YES));
    document.add(new StringField(PROJECT, id(entry.projectId()), Store.YES));
    document.add(new StringField(OWNER, entry.ownerId().asString(), Store.YES));
    document.add(new StringField(SOURCE, entry.sourcePath(), Store.YES));
    document.add(new StringField(INDEX_STATE, entry.indexState().name(), Store.YES));
    document.add(new TextField(CONTENT, content == null ? "" : content, Store.YES));
    return document;
  }

  private static Query scopedQuery(ResourceId projectId, ResourceId ownerId,
                                   String text, StandardAnalyzer analyzer) {
    BooleanQuery.Builder query = new BooleanQuery.Builder();
    query.add(projectScope(projectId), Occur.FILTER);
    query.add(ownerScope(ownerId), Occur.FILTER);
    Query content = new QueryBuilder(analyzer).createBooleanQuery(
        CONTENT, text == null ? "" : text);
    query.add(content == null ? new MatchAllDocsQuery() : content, Occur.MUST);
    return query.build();
  }

  private static Query scopedQuery(MemoryAccessContext context, String text,
                                   StandardAnalyzer analyzer) {
    BooleanQuery.Builder query = new BooleanQuery.Builder();
    BooleanQuery.Builder scope = new BooleanQuery.Builder();
    scope.add(new TermQuery(new Term(SCOPE, MemoryScope.GLOBAL.name())), Occur.SHOULD);
    scope.add(projectScopeTerm(context.projectId()), Occur.SHOULD);
    if (context.agentInstanceId() != null) {
      scope.add(new BooleanQuery.Builder()
          .add(new TermQuery(new Term(SCOPE, MemoryScope.AGENT.name())), Occur.MUST)
          .add(new TermQuery(new Term(OWNER, context.agentInstanceId().asString())), Occur.MUST)
          .build(), Occur.SHOULD);
    }
    scope.add(new BooleanQuery.Builder()
        .add(new TermQuery(new Term(SCOPE, MemoryScope.CONVERSATION.name())), Occur.MUST)
        .add(new TermQuery(new Term(OWNER, context.conversationId().asString())), Occur.MUST)
        .build(), Occur.SHOULD);
    scope.setMinimumNumberShouldMatch(1);
    query.add(scope.build(), Occur.FILTER);
    Query content = new QueryBuilder(analyzer).createBooleanQuery(CONTENT,
        text == null ? "" : text);
    query.add(content == null ? new MatchAllDocsQuery() : content, Occur.MUST);
    return query.build();
  }

  private static Query projectScopeTerm(ResourceId projectId) {
    return new BooleanQuery.Builder()
        .add(new TermQuery(new Term(SCOPE, MemoryScope.PROJECT.name())), Occur.MUST)
        .add(new TermQuery(new Term(PROJECT, projectId.asString())), Occur.MUST)
        .build();
  }

  private static Query projectScope(ResourceId projectId) {
    BooleanQuery.Builder scope = new BooleanQuery.Builder();
    scope.add(new TermQuery(new Term(SCOPE, MemoryScope.GLOBAL.name())),
              Occur.SHOULD);
    scope.add(new TermQuery(new Term(PROJECT, projectId.asString())),
              Occur.SHOULD);
    scope.setMinimumNumberShouldMatch(1);
    return scope.build();
  }

  private static Query ownerScope(ResourceId ownerId) {
    BooleanQuery.Builder scope = new BooleanQuery.Builder();
    scope.add(new TermQuery(new Term(SCOPE, MemoryScope.GLOBAL.name())),
              Occur.SHOULD);
    scope.add(new TermQuery(new Term(OWNER, ownerId.asString())),
              Occur.SHOULD);
    scope.setMinimumNumberShouldMatch(1);
    return scope.build();
  }

  private static Result document(IndexSearcher searcher, int documentId) {
    try {
      Document document = searcher.storedFields().document(documentId);
      String content = document.get(CONTENT);
      String excerpt = content.substring(0, Math.min(240, content.length()));
      return new Result(ResourceId.parse(document.get(ID)), document.get(SCOPE),
                        parseOptional(document.get(OWNER)), document.get(SOURCE),
                        MemoryEntry.IndexState.valueOf(document.get(INDEX_STATE)), excerpt);
    } catch (IOException failure) {
      throw unavailable(failure);
    }
  }

  private static Path indexRoot(String configuredRoot) {
    if (configuredRoot == null || configuredRoot.isBlank()) {
      return Path.of(System.getProperty("user.home"), ".zeko-agentstudio",
                     "lucene-context");
    }
    return Path.of(configuredRoot);
  }

  private static String id(ResourceId value) {
    return value == null ? "" : value.asString();
  }

  private static ResourceId parseOptional(String value) {
    return value == null || value.isBlank() ? null : ResourceId.parse(value);
  }

  private static DomainError unavailable(IOException failure) {
    return DomainError.providerUnavailable(
        "El indice Lucene local no esta disponible: " + failure.getMessage());
  }
}
