import { describe, expect, it } from "vitest";
import { classify } from "../classify";

describe("classify", () => {
  it("maps topics to platforms and categories in taxonomy order", () => {
    const result = classify({ topics: ["music-player", "linux", "android"], description: "A music player", language: "Kotlin" });
    expect(result.platforms).toEqual(["android", "linux"]);
    expect(result.categories).toEqual(["media"]);
    expect(result.kind).toBe("app");
  });

  it("expands desktop frameworks to the three desktop platforms", () => {
    const result = classify({ topics: ["electron"], description: "Notes app", language: "TypeScript" });
    expect(result.platforms).toEqual(["macos", "windows", "linux"]);
  });

  it("uses description hints", () => {
    const result = classify({ topics: [], description: "A self-hosted photo gallery for Android", language: "Go" });
    expect(result.platforms).toEqual(["android", "selfhosted"]);
  });

  it("detects libraries", () => {
    expect(classify({ topics: ["react", "ui-components"], description: "Component library", language: "TypeScript" }).kind).toBe("library");
    expect(classify({ topics: [], description: "A Python SDK for the X API", language: "Python" }).kind).toBe("library");
  });

  it("app topics win over library hints", () => {
    expect(classify({ topics: ["self-hosted", "framework"], description: null, language: null }).kind).toBe("app");
  });

  it("treats CLI-only projects as tools", () => {
    expect(classify({ topics: ["cli", "rust"], description: "A fast grep", language: "Rust" }).kind).toBe("tool");
  });

  it("guesses Apple platform for untagged Swift apps", () => {
    expect(classify({ topics: [], description: "Clipboard manager app for Mac", language: "Swift" }).platforms).toEqual(["macos"]);
  });
});

describe("classify resources and libraries", () => {
  it("detects lists and learning material before app topics", () => {
    expect(classify({ name: "awesome-selfhosted", topics: ["self-hosted"], description: "A list of Free Software", language: null }).kind).toBe("resource");
    expect(classify({ name: "free-programming-books", topics: ["books"], description: "Freely available programming books", language: null }).kind).toBe("resource");
    expect(classify({ name: "architecture-samples", topics: ["android"], description: "A collection of samples to discuss", language: "Kotlin" }).kind).toBe("resource");
  });

  it("detects JVM libraries tagged with android", () => {
    expect(classify({ name: "okhttp", topics: ["android", "java", "kotlin"], description: "Meticulous HTTP client for the JVM, Android, and GraalVM.", language: "Kotlin" }).kind).toBe("library");
  });

  it("keeps real apps as apps", () => {
    expect(classify({ name: "scrcpy", topics: ["android", "screen", "mirroring"], description: "Display and control your Android device", language: "C" }).kind).toBe("app");
    expect(classify({ name: "joplin", topics: ["note-taking", "android", "linux"], description: "Joplin - the privacy-focused note taking app", language: "TypeScript" }).kind).toBe("app");
  });
});

describe("classify AI", () => {
  it("treats MCP servers and agent plugins as the AI platform", () => {
    expect(classify({ topics: ["mcp-server", "github"], description: "GitHub's official MCP Server", language: "Go" }).platforms).toEqual(["ai"]);
    expect(classify({ topics: [], description: "A Model Context Protocol server for Postgres", language: "TypeScript" }).platforms).toEqual(["ai"]);
    expect(classify({ topics: [], description: "Agent skills for Claude Code", language: null }).platforms).toEqual(["ai"]);
  });

  it("maps AI topics to the AI category group", () => {
    const result = classify({ topics: ["ollama", "llm-ui", "rag", "self-hosted"], description: "Chat with local models", language: "TypeScript" });
    expect(result.categories).toEqual(["ai-chat", "ai-local", "ai-rag"]);
    expect(result.platforms).toEqual(["selfhosted"]);
    expect(result.kind).toBe("app");
  });

  it("keeps general ML under Machine learning", () => {
    expect(classify({ topics: ["pytorch", "deep-learning"], description: "Tensors and dynamic neural networks", language: "Python" }).categories).toEqual(["ml"]);
  });
});
