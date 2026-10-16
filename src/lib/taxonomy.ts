// Single source of truth for platforms, categories and kinds.
// Array order defines the bit index used in the search index (rebuilt with the site),
// and URLs use the ids, so ids must stay stable. At most 31 entries per list.

export type Platform = {
  id: string;
  label: string;
  topics: string[];
};

export type Category = {
  id: string;
  label: string;
  topics: string[];
  group?: "ai";
};

export const PLATFORMS: Platform[] = [
  { id: "android", label: "Android", topics: ["android", "android-app", "android-application", "fdroid", "f-droid", "jetpack-compose", "android-apps"] },
  { id: "ios", label: "iOS", topics: ["ios", "ios-app", "iphone", "ipad", "ipados", "ios-application", "ios-apps"] },
  { id: "macos", label: "macOS", topics: ["macos", "macos-app", "mac", "osx", "mac-os", "macosx", "menubar", "menu-bar", "menubar-app", "menu-bar-app", "macos-application"] },
  { id: "windows", label: "Windows", topics: ["windows", "windows-app", "win32", "wpf", "winui", "winui3", "uwp", "windows-10", "windows-11", "winforms"] },
  { id: "linux", label: "Linux", topics: ["linux", "linux-app", "gtk", "gtk3", "gtk4", "gnome", "kde", "flatpak", "wayland", "libadwaita", "linux-desktop", "x11"] },
  { id: "web", label: "Web", topics: ["web-app", "webapp", "pwa", "progressive-web-app", "web-application", "single-page-app", "spa"] },
  { id: "selfhosted", label: "Self-hosted", topics: ["self-hosted", "selfhosted", "homelab", "self-hosting", "selfhost"] },
  { id: "cli", label: "CLI", topics: ["cli", "command-line", "terminal", "tui", "command-line-tool", "cli-app", "terminal-app", "commandline", "shell"] },
  { id: "extension", label: "Browser extension", topics: ["browser-extension", "chrome-extension", "firefox-extension", "firefox-addon", "webextension", "web-extension", "userscript", "chrome-extensions", "edge-extension"] },
  // Runs inside or plugs into AI assistants, agents and model runtimes.
  { id: "ai", label: "AI", topics: ["mcp-server", "mcp", "model-context-protocol", "claude-code", "mcp-servers", "agent-skills", "claude-skills", "claude-code-plugin", "codex-cli", "cursor-rules", "chatgpt-plugin", "chatgpt-app", "gpts", "copilot-extension", "openai-apps-sdk", "ollama-models", "modelfile", "a2a", "mcp-client"] },
];

// Topics that imply several desktop platforms at once.
export const DESKTOP_TOPICS = ["electron", "electron-app", "tauri", "tauri-app", "desktop-app", "desktop-application", "cross-platform-desktop"];

export const CATEGORIES: Category[] = [
  { id: "productivity", label: "Productivity", topics: ["productivity", "todo", "todo-app", "task-manager", "calendar", "time-tracking", "pomodoro", "kanban", "office", "spreadsheet", "project-management"] },
  { id: "notes", label: "Notes & Knowledge", topics: ["note-taking", "notes", "notes-app", "markdown-editor", "knowledge-base", "wiki", "personal-knowledge-management", "pkm", "zettelkasten", "outliner", "journal"] },
  { id: "media", label: "Audio & Video", topics: ["music", "music-player", "audio", "audio-player", "video", "video-player", "media-player", "podcast", "streaming", "youtube", "media-server", "spotify", "music-streaming", "video-editor", "screen-recorder", "iptv"] },
  { id: "graphics", label: "Photos & Graphics", topics: ["photos", "photo", "image-editor", "photography", "gallery", "drawing", "painting", "graphics", "design", "image-viewer", "pixel-art", "3d", "vector-graphics", "screenshot"] },
  { id: "dev", label: "Development", topics: ["developer-tools", "devtools", "ide", "code-editor", "git", "git-client", "api-client", "database-gui", "debugger", "text-editor", "devops", "ci", "editor"] },
  { id: "security", label: "Security & Privacy", topics: ["security", "privacy", "password-manager", "encryption", "2fa", "totp", "vpn", "ad-blocker", "adblock", "firewall", "authenticator", "pentest", "privacy-tools"] },
  { id: "communication", label: "Communication", topics: ["chat", "messaging", "messenger", "email", "email-client", "matrix", "xmpp", "irc", "voip", "video-conferencing", "telegram", "discord", "signal"] },
  { id: "finance", label: "Finance", topics: ["finance", "budget", "budgeting", "accounting", "personal-finance", "money", "expense-tracker", "invoice", "cryptocurrency", "wallet", "bitcoin"] },
  { id: "games", label: "Games", topics: ["game", "games", "gaming", "emulator", "game-engine", "retro-gaming", "puzzle-game", "minecraft", "game-launcher"] },
  { id: "education", label: "Education", topics: ["education", "learning", "flashcards", "anki", "language-learning", "e-learning", "quiz", "teaching", "spaced-repetition"] },
  { id: "health", label: "Health & Fitness", topics: ["health", "fitness", "workout", "medical", "healthcare", "meditation", "sleep", "habit-tracker", "exercise"] },
  { id: "networking", label: "Networking", topics: ["networking", "network", "proxy", "dns", "torrent", "bittorrent", "p2p", "ssh", "ftp", "download-manager", "network-monitoring", "wireguard"] },
  { id: "home", label: "Home automation", topics: ["home-automation", "smart-home", "home-assistant", "iot", "homeassistant", "zigbee", "mqtt"] },
  { id: "files", label: "Files & Sync", topics: ["file-manager", "file-sharing", "sync", "backup", "cloud-storage", "file-sync", "storage", "file-explorer", "nas", "webdav"] },
  { id: "reading", label: "Reading & E-books", topics: ["ebook", "ebooks", "ebook-reader", "epub", "reader", "rss", "rss-reader", "manga", "comics", "pdf-viewer", "news", "read-it-later", "audiobook"] },
  { id: "maps", label: "Maps & Navigation", topics: ["maps", "map", "navigation", "gps", "openstreetmap", "osm", "gis", "location"] },
  { id: "utilities", label: "Utilities", topics: ["utility", "utilities", "clipboard", "launcher", "window-manager", "system-monitor", "keyboard", "automation", "calculator", "screenshot-tool", "tiling-window-manager", "dotfiles"] },
  { id: "social", label: "Social", topics: ["social-network", "fediverse", "mastodon", "activitypub", "reddit", "twitter", "social-media", "forum", "lemmy", "nostr", "bluesky"] },

  // AI group, shown in its own filter section.
  { id: "ai-chat", label: "Chat & assistants", group: "ai", topics: ["chatgpt", "chatbot", "ai-assistant", "ai-chat", "llm-ui", "chat-ui", "chatgpt-app", "claude", "gemini", "personal-assistant", "llm-chat", "openai-chat"] },
  { id: "ai-agents", label: "Agents & automation", group: "ai", topics: ["ai-agents", "ai-agent", "agents", "agentic-ai", "autonomous-agents", "multi-agent", "agentic", "langgraph", "crewai", "autogen", "browser-use", "computer-use", "agent-framework"] },
  { id: "ai-coding", label: "Coding assistants", group: "ai", topics: ["ai-coding", "coding-assistant", "code-generation", "claude-code", "ai-code", "copilot", "codex", "vibe-coding", "ai-coding-assistant", "code-assistant", "ai-pair-programming"] },
  { id: "ai-local", label: "Local models & inference", group: "ai", topics: ["local-llm", "ollama", "llama-cpp", "llm-inference", "llamacpp", "gguf", "inference", "vllm", "inference-engine", "on-device-ai", "self-hosted-ai", "llama", "mlx", "quantization"] },
  { id: "ai-image", label: "Image & video generation", group: "ai", topics: ["stable-diffusion", "image-generation", "text-to-image", "comfyui", "diffusion-models", "video-generation", "text-to-video", "ai-art", "generative-art", "midjourney"] },
  { id: "ai-voice", label: "Speech & voice", group: "ai", topics: ["speech-recognition", "text-to-speech", "tts", "whisper", "speech-to-text", "voice-assistant", "voice-cloning", "asr", "speech-synthesis", "voice-ai", "stt", "transcription"] },
  { id: "ai-rag", label: "RAG & knowledge", group: "ai", topics: ["rag", "retrieval-augmented-generation", "vector-database", "embeddings", "knowledge-graph", "semantic-search", "graphrag", "vector-search", "document-qa", "chat-with-pdf"] },
  { id: "ai-dev", label: "LLM dev tools", group: "ai", topics: ["llmops", "prompt-engineering", "llm-evaluation", "llm-framework", "ai-gateway", "llm-observability", "fine-tuning", "evals", "prompt-management", "langchain", "llamaindex", "llm-tools", "structured-output"] },
  { id: "ml", label: "Machine learning", group: "ai", topics: ["machine-learning", "deep-learning", "artificial-intelligence", "ai", "pytorch", "tensorflow", "computer-vision", "nlp", "neural-network", "data-science", "llm", "openai", "generative-ai", "transformers"] },
];

export const KINDS = [
  { id: "app", label: "Apps" },
  { id: "tool", label: "Tools" },
  { id: "library", label: "Libraries" },
  { id: "resource", label: "Lists & learning" },
] as const;

export type Kind = (typeof KINDS)[number]["id"];

export const LIBRARY_TOPICS = ["library", "framework", "sdk", "package", "component", "components", "ui-components", "react-components", "npm-package", "plugin", "boilerplate", "template", "starter", "starter-kit", "api-wrapper", "android-library", "kotlin-library", "swift-library", "ios-library", "flutter-package", "dart-package", "swift-package", "http-client", "orm", "dependency-injection", "design-system", "ui-kit", "react-native-component", "android-sdk", "jetpack", "kotlin-multiplatform-library", "npm", "crate", "pypi", "bindings", "headless", "ui-library", "ui-framework", "web-framework", "css-framework"];
export const APP_TOPICS = ["app", "application", "desktop-app", "desktop-application", "mobile-app", "self-hosted", "selfhosted", "android-app", "ios-app", "macos-app", "windows-app", "linux-app", "web-app", "webapp", "pwa", "electron-app", "tauri-app", "menubar-app", "browser-extension", "chrome-extension", "firefox-extension", "firefox-addon"];
export const RESOURCE_TOPICS = ["awesome", "awesome-list", "awesome-lists", "list", "lists", "resources", "learning-resources", "books", "book", "free-books", "ebooks-list", "tutorial", "tutorials", "course", "courses", "interview", "interview-questions", "interview-preparation", "cheatsheet", "cheatsheets", "roadmap", "samples", "sample-app", "sample-code", "examples", "example-project", "icons", "icon-pack", "icon-set", "iconset", "guide", "guides", "documentation", "public-apis", "free-for-dev"];
export const TOOL_TOPICS = ["cli", "command-line", "command-line-tool", "tui", "terminal", "developer-tools", "devtools", "tool", "tools", "cli-app"];

// Seed searches used by ingestion: one per strong app-ish topic.
export const SEED_TOPICS: string[] = Array.from(
  new Set([
    ...PLATFORMS.flatMap((p) => p.topics.slice(0, 4)),
    ...DESKTOP_TOPICS.slice(0, 4),
    ...CATEGORIES.flatMap((c) => c.topics.slice(0, 4)),
  ]),
);
