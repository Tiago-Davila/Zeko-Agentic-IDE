package com.zeko.coordination.infrastructure;

import com.zeko.coordination.application.AgentLoop.ModelGateway;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.stereotype.Component;

@Component
public class LocalModelGateway implements ModelGateway {
  private static final URI LOCAL_GENERATE =
      URI.create("http://127.0.0.1:11434/api/generate");
  private final HttpClient client =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();

  @Override
  public String generate(String prompt) {
    try {
      HttpRequest request = HttpRequest.newBuilder(LOCAL_GENERATE)
                                .timeout(Duration.ofSeconds(30))
                                .POST(HttpRequest.BodyPublishers.ofString(
                                    "{\"model\":\"local\",\"prompt\":\"" +
                                    escape(prompt) + "\",\"stream\":false}"))
                                .build();
      HttpResponse<String> response =
          client.send(request, HttpResponse.BodyHandlers.ofString());
      return response.statusCode() == 200 ? response.body()
                                          : "LOCAL_MODEL_UNAVAILABLE";
    } catch (IOException unavailable) {
      return "LOCAL_MODEL_UNAVAILABLE";
    } catch (InterruptedException unavailable) {
      Thread.currentThread().interrupt();
      return "LOCAL_MODEL_UNAVAILABLE";
    }
  }

  private static String escape(String value) {
    return value.replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n");
  }
}
