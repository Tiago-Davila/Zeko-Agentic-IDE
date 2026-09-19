package com.zeko.executioncontrol.infrastructure;

import com.zeko.executioncontrol.application.LocalModelPort;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.stereotype.Component;

@Component
public class OllamaLocalClient implements LocalModelPort {
  private static final URI LOCAL_GENERATE =
      URI.create("http://127.0.0.1:11434/api/generate");
  private final HttpClient client =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
  @Override
  public Generation generate(String model, String prompt) {
    if (model == null || model.isBlank() || prompt == null) {
      return new Generation(Generation.Status.FAILED, "",
                            "Solicitud local invalida");
    }
    String body = "{\"model\":\"" + escape(model) + "\",\"prompt\":\"" +
                  escape(prompt) + "\",\"stream\":false}";
    try {
      HttpResponse<String> response =
          client.send(HttpRequest.newBuilder(LOCAL_GENERATE)
                          .POST(HttpRequest.BodyPublishers.ofString(body))
                          .timeout(Duration.ofSeconds(30))
                          .build(),
                      HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200) {
        return new Generation(Generation.Status.FAILED, "",
                              "Ollama respondio " + response.statusCode());
      }
      return new Generation(Generation.Status.COMPLETED, response.body(),
                            "FINAL");
    } catch (java.io.IOException unavailable) {
      return new Generation(Generation.Status.UNAVAILABLE, "",
                            "Ollama local no disponible");
    } catch (InterruptedException unavailable) {
      Thread.currentThread().interrupt();
      return new Generation(Generation.Status.UNAVAILABLE, "",
                            "Ollama local no disponible");
    }
  }
  private static String escape(String text) {
    return text.replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n");
  }
}
