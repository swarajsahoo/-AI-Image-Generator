// AI Image Generator – Student Edition with FREE APIs
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  class APIError extends Error {
    constructor(message, status, type) {
      super(message);
      this.name = "APIError";
      this.status = status;
      this.type = type;
    }
  }

  class AIImageGenerator {
    constructor() {
      // Configuration
      this.maxPromptLength = 400;
      this.maxRetries = 3;

      // FREE API configurations for students
      this.apiConfig = {
        // Option 1: Pollinations.ai (Completely FREE - No API key needed!)
        pollinations: {
          endpoint: 'https://image.pollinations.ai/prompt/',
          // No API key required!
        },

        // Option 2: Hugging Face Inference API (FREE tier - 1000 requests/month)
        huggingFaceFree: {
          apiKey: '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', // Get free at https://huggingface.co/
          models: [
            'stabilityai/stable-diffusion-2-1',
            'runwayml/stable-diffusion-v1-5',
            'prompthero/openjourney-v4',
            'wavymulder/Analog-Diffusion'
          ]
        },

        // Option 3: Replicate (FREE tier - Some free usage)
        replicate: {
          apiKey: 'r8_dLcaB9a8xAVCu9WjoUL3db8VkVGhW5J1PWF0b', // Get free credits at https://replicate.com/
          model: 'stability-ai/stable-diffusion'
        },

        // Option 4: DeepAI (FREE tier with watermark)
        deepAI: {
          apiKey: 'c7c6051d-dc87-4205-9f37-545e2da0fce4', // Get free at https://deepai.org/
          endpoint: 'https://api.deepai.org/api/text2img'
        }
      };

      // State
      this.currentPrompt = "";
      this.currentSize = "512x512";
      this.currentStyle = "realistic";
      this.currentNegativePrompt = "";
      this.generatedImages = [];
      this.promptHistory = [];
      this.isGenerating = false;
      this.retryCount = 0;

      // Example prompts for suggestions
      this.examplePrompts = [
        "A serene mountain lake at sunrise, surrounded by misty pine forests and soft morning fog, photorealistic details, cinematic lighting",
        "A cozy coffee shop on a rainy autumn day, foggy windows, warm lights, people reading, atmospheric realism with painterly touches",
        "A dreamy sunflower field under a deep blue sky, golden sunlight, gentle breeze, wide landscape, bright and cheerful, realistic style",
        "A mystical castle floating in the clouds, spires reaching upward, soft golden sunlight, fantasy art style with painterly detail"
      ];

      // Initialize when DOM ready
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => this.init());
      } else {
        this.init();
      }
    }

    /* ---------------------- INITIALIZATION ---------------------- */
    init() {
      this.cacheDOM();
      this.createParticles();
      this.bindEvents();
      this.populateSuggestions();
      this.updateCharCounter();
      this.updateNetworkStatus();
      this.showGalleryPlaceholder();
      setInterval(() => this.updateNetworkStatus(), 15000);
      console.info("AI Image Generator initialized ✅");
    }

    cacheDOM() {
      this.dom = {
        promptInput: $("promptInput"),
        generateBtn: $("generateBtn"),
        form: $("imageForm"),
        charCounter: document.querySelector(".char-counter"),
        sizeOptions: $("sizeOptions"),
        styleSelect: $("styleSelect"),
        negativePrompt: $("negativePrompt"),
        enhanceBtn: $("enhanceBtn"),
        suggestionsList: $("suggestionsList"),
        historyList: $("historyList"),
        historySection: $("historySection"),
        retryBtn: $("retryBtn"),
        progressContainer: $("progressContainer"),
        progressBar: $("progressBar"),
        progressText: $("progressText"),
        loadingOverlay: $("loadingOverlay"),
        loadingSubtitle: $("loadingSubtitle"),
        retrySection: $("retrySection"),
        errorMessage: $("errorMessage"),
        galleryGrid: $("galleryGrid"),
        galleryPlaceholder: $("galleryPlaceholder"),
        toastContainer: $("toastContainer"),
        networkStatus: $("networkStatus")
      };
    }

    /* ------------------------ PARTICLES ------------------------- */
    createParticles() {
      const container = $("particles");
      if (!container) return;
      for (let i = 0; i < 40; i++) {
        const p = document.createElement("span");
        p.className = "particle";
        p.style.left = Math.random() * 100 + "%";
        p.style.animationDelay = Math.random() * 8 + "s";
        container.appendChild(p);
      }
    }

    /* ------------------------- EVENTS --------------------------- */
    bindEvents() {
      if (this.dom.form) {
        this.dom.form.addEventListener("submit", (e) => {
          e.preventDefault();
          this.handleGenerate();
        });
      }

      if (this.dom.generateBtn) {
        this.dom.generateBtn.addEventListener("click", (e) => {
          e.preventDefault();
          this.handleGenerate();
        });
      }

      if (this.dom.promptInput) {
        this.dom.promptInput.addEventListener("input", (e) => {
          this.currentPrompt = e.target.value;
          this.updateCharCounter();
        });
      }

      if (this.dom.sizeOptions) {
        this.dom.sizeOptions.addEventListener("click", (e) => {
          const btn = e.target.closest(".size-btn");
          if (!btn) return;
          this.dom.sizeOptions.querySelectorAll(".size-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.currentSize = btn.dataset.size;
        });
      }

      if (this.dom.styleSelect) {
        this.dom.styleSelect.addEventListener("change", (e) => {
          this.currentStyle = e.target.value;
        });
      }

      if (this.dom.negativePrompt) {
        this.dom.negativePrompt.addEventListener("input", (e) => {
          this.currentNegativePrompt = e.target.value;
        });
      }

      if (this.dom.enhanceBtn) {
        this.dom.enhanceBtn.addEventListener("click", () => this.enhancePrompt());
      }

      if (this.dom.retryBtn) {
        this.dom.retryBtn.addEventListener("click", () => this.handleRetry());
      }

      if (this.dom.suggestionsList) {
        this.dom.suggestionsList.addEventListener("click", (e) => {
          const s = e.target.closest(".suggestion-btn");
          if (!s) return;
          this.dom.promptInput.value = s.dataset.prompt;
          this.currentPrompt = s.dataset.prompt;
          this.updateCharCounter();
        });
      }

      if (this.dom.historyList) {
        this.dom.historyList.addEventListener("click", (e) => {
          const h = e.target.closest(".history-item");
          if (!h) return;
          this.dom.promptInput.value = h.dataset.prompt;
          this.currentPrompt = h.dataset.prompt;
          this.updateCharCounter();
        });
      }

      window.addEventListener("online", () => this.updateNetworkStatus());
      window.addEventListener("offline", () => this.updateNetworkStatus());
    }

    /* ---------------------- PROMPT UTILS ------------------------ */
    updateCharCounter() {
      if (!this.dom.charCounter) return;
      const len = this.currentPrompt.length || 0;
      this.dom.charCounter.textContent = `${len}/${this.maxPromptLength}`;
      if (len > 350) {
        this.dom.charCounter.style.color = "var(--color-warning)";
      } else if (len > 300) {
        this.dom.charCounter.style.color = "var(--color-info)";
      } else {
        this.dom.charCounter.style.color = "var(--color-text-secondary)";
      }
    }

    populateSuggestions() {
      if (!this.dom.suggestionsList) return;
      const suggestions = this.examplePrompts.slice(0, 4);
      this.dom.suggestionsList.innerHTML = suggestions
        .map((p) => `<span class="suggestion-btn" data-prompt="${p}">${this.truncate(p, 26)}</span>`)
        .join("");
    }

    enhancePrompt() {
      if (!this.currentPrompt.trim()) {
        this.toast("Please enter a prompt first", "error");
        return;
      }
      const additions = [
        "highly detailed",
        "cinematic lighting",
        "4K resolution",
        "trending on artstation",
        "sharp focus",
        "professional photography",
        "masterpiece",
        "award winning"
      ];
      const random = additions.sort(() => 0.5 - Math.random()).slice(0, 2).join(", ");
      const enhanced = `${this.currentPrompt}, ${random}`;
      this.currentPrompt = enhanced;
      this.dom.promptInput.value = enhanced;
      this.updateCharCounter();
      this.toast("Prompt enhanced", "success");
    }

    /* -------------------- VALIDATION -------------------- */
    validatePrompt() {
      const p = this.currentPrompt.trim();
      if (p.length < 3) return { ok: false, msg: "Prompt is too short" };
      if (p.length > this.maxPromptLength) return { ok: false, msg: "Prompt exceeds 400 characters" };

      // Content policy check
      const banned = ["nsfw", "explicit", "gore", "violence", "nude", "sexual"];
      if (banned.some((b) => p.toLowerCase().includes(b))) {
        return { ok: false, msg: "Prompt may violate content policy" };
      }
      return { ok: true };
    }

    /* -------------------- FREE AI GENERATION -------------------- */
    async handleGenerate() {
      const val = this.validatePrompt();
      if (!val.ok) {
        this.toast(val.msg, "error");
        return;
      }
      if (this.isGenerating) return;

      this.beginGenerationUI();
      try {
        const images = await this.generateWithFreeAI();
        this.onGenerationSuccess(images);
      } catch (err) {
        this.onGenerationError(err);
      }
    }

    async generateWithFreeAI() {
      // Try free AI services in order of preference
      const methods = [
        () => this.generateWithPollinations(), // 100% Free, no signup needed!
        () => this.generateWithHuggingFaceFree(),
        () => this.generateWithDeepAI(),
        () => this.generateWithReplicate(),
        () => this.createStudentDemo() // Custom demo for students
      ];

      let lastError;
      for (let i = 0; i < methods.length; i++) {
        try {
          return await methods[i]();
        } catch (e) {
          lastError = e;
          console.warn(`Method ${i + 1} failed:`, e.message);
        }
      }
      throw lastError || new Error("All generation methods failed");
    }

    // Method 1: Pollinations.ai (100% FREE - No API key needed!)
    async generateWithPollinations() {
      this.updateProgress(20, "Connecting to Pollinations.ai (FREE)...");

      const enhancedPrompt = this.buildEnhancedPrompt();
      const encodedPrompt = encodeURIComponent(enhancedPrompt);

      // Pollinations supports various parameters
      const [width, height] = this.currentSize.split('x').map(Number);
      const seed = Math.floor(Math.random() * 1000000); // Random seed for variety

      const url = `${this.apiConfig.pollinations.endpoint}${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&enhance=true&model=flux`;

      this.updateProgress(60, "Generating image with AI...");

      // Simple fetch - no API key needed!
      const response = await fetch(url);

      if (!response.ok) {
        throw new APIError(`Pollinations API error: ${response.status}`, response.status, "server_error");
      }

      this.updateProgress(90, "Processing results...");

      // The URL itself is the image
      return [{
        id: Date.now(),
        url: url,
        prompt: this.currentPrompt,
        size: this.currentSize,
        source: "Pollinations.ai (Free)"
      }];
    }

    // Method 2: Hugging Face Free Tier
    async generateWithHuggingFaceFree() {
      if (!this.apiConfig.huggingFaceFree.apiKey || this.apiConfig.huggingFaceFree.apiKey === 'YOUR_FREE_HUGGINGFACE_TOKEN') {
        throw new Error("Hugging Face token not configured");
      }

      this.updateProgress(20, "Connecting to Hugging Face (Free)...");

      // Try different models until one works
      const models = this.apiConfig.huggingFaceFree.models;
      const model = models[Math.floor(Math.random() * models.length)];

      const endpoint = `https://api-inference.huggingface.co/models/${model}`;

      const requestBody = {
        inputs: this.buildEnhancedPrompt(),
        parameters: {
          negative_prompt: this.currentNegativePrompt || "blurry, low quality, bad anatomy",
          num_inference_steps: 20, // Fewer steps for faster generation
          guidance_scale: 7.5
        }
      };

      this.updateProgress(50, "Generating with Stable Diffusion...");

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiConfig.huggingFaceFree.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 503) {
          throw new Error("Model is loading, please try again in a few minutes");
        }
        throw new APIError(`Hugging Face error: ${response.status}`, response.status, "server_error");
      }

      this.updateProgress(90, "Processing results...");

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);

      return [{
        id: Date.now(),
        url: imageUrl,
        prompt: this.currentPrompt,
        size: this.currentSize,
        source: `Hugging Face (${model.split('/')[1]})`
      }];
    }

    // Method 3: DeepAI Free Tier
    async generateWithDeepAI() {
      if (!this.apiConfig.deepAI.apiKey || this.apiConfig.deepAI.apiKey === 'YOUR_FREE_DEEPAI_KEY') {
        throw new Error("DeepAI API key not configured");
      }

      this.updateProgress(30, "Connecting to DeepAI (Free)...");

      const formData = new FormData();
      formData.append('text', this.buildEnhancedPrompt());

      this.updateProgress(60, "Generating with DeepAI...");

      const response = await fetch(this.apiConfig.deepAI.endpoint, {
        method: 'POST',
        headers: {
          'api-key': this.apiConfig.deepAI.apiKey
        },
        body: formData
      });

      if (!response.ok) {
        throw new APIError(`DeepAI error: ${response.status}`, response.status, "server_error");
      }

      const data = await response.json();
      this.updateProgress(90, "Processing results...");

      return [{
        id: Date.now(),
        url: data.output_url,
        prompt: this.currentPrompt,
        size: this.currentSize,
        source: "DeepAI (Free - with watermark)"
      }];
    }

    // Method 4: Replicate Free Credits
    async generateWithReplicate() {
      if (!this.apiConfig.replicate.apiKey || this.apiConfig.replicate.apiKey === 'YOUR_FREE_REPLICATE_TOKEN') {
        throw new Error("Replicate token not configured");
      }

      this.updateProgress(30, "Connecting to Replicate (Free credits)...");

      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiConfig.replicate.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          version: "ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
          input: {
            prompt: this.buildEnhancedPrompt(),
            negative_prompt: this.currentNegativePrompt || "blurry, bad quality",
            width: parseInt(this.currentSize.split('x')[0]),
            height: parseInt(this.currentSize.split('x')[1]),
            num_inference_steps: 20,
            guidance_scale: 7.5
          }
        })
      });

      if (!response.ok) {
        throw new APIError(`Replicate error: ${response.status}`, response.status, "server_error");
      }

      const prediction = await response.json();

      // Poll for completion
      let result = prediction;
      while (result.status === 'starting' || result.status === 'processing') {
        this.updateProgress(70, "AI is working on your image...");
        await this.sleep(2000);

        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
          headers: {
            'Authorization': `Token ${this.apiConfig.replicate.apiKey}`
          }
        });
        result = await statusResponse.json();
      }

      if (result.status === 'failed') {
        throw new Error("Generation failed");
      }

      this.updateProgress(90, "Processing results...");

      return [{
        id: Date.now(),
        url: result.output[0],
        prompt: this.currentPrompt,
        size: this.currentSize,
        source: "Replicate (Free credits)"
      }];
    }

    // Method 5: Student Demo (when all else fails)
    async createStudentDemo() {
      this.updateProgress(50, "Creating student demo...");
      await this.sleep(1000);

      const canvas = document.createElement('canvas');
      const [width, height] = this.currentSize.split('x').map(Number);
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');

      // Create a unique visualization based on the prompt
      const hash = this.hashString(this.currentPrompt);
      const hue = hash % 360;
      const saturation = 50 + (hash % 30);
      const lightness = 40 + (hash % 20);

      // Create an artistic gradient
      const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
      gradient.addColorStop(0, `hsl(${hue}, ${saturation}%, ${lightness + 20}%)`);
      gradient.addColorStop(0.7, `hsl(${(hue + 60) % 360}, ${saturation}%, ${lightness}%)`);
      gradient.addColorStop(1, `hsl(${(hue + 120) % 360}, ${saturation}%, ${lightness - 10}%)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Add some geometric shapes based on prompt keywords
      this.addShapesBasedOnPrompt(ctx, width, height, hash);

      // Add text overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 2;

      const fontSize = Math.min(width, height) / 15;
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const title = "STUDENT DEMO";
      ctx.strokeText(title, width / 2, height / 2 - fontSize);
      ctx.fillText(title, width / 2, height / 2 - fontSize);

      ctx.font = `${fontSize * 0.6}px Arial`;
      const subtitle = "Get free API keys above!";
      ctx.strokeText(subtitle, width / 2, height / 2 + fontSize / 2);
      ctx.fillText(subtitle, width / 2, height / 2 + fontSize / 2);

      this.updateProgress(90, "Finalizing demo...");

      const dataUrl = canvas.toDataURL('image/png');

      return [{
        id: Date.now(),
        url: dataUrl,
        prompt: this.currentPrompt,
        size: this.currentSize,
        source: "Student Demo Mode"
      }];
    }

    addShapesBasedOnPrompt(ctx, width, height, hash) {
      const prompt = this.currentPrompt.toLowerCase();

      // Add shapes based on keywords in the prompt
      if (prompt.includes('circle') || prompt.includes('sun') || prompt.includes('moon')) {
        ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
        ctx.beginPath();
        ctx.arc(width * 0.7, height * 0.3, Math.min(width, height) * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }

      if (prompt.includes('triangle') || prompt.includes('mountain') || prompt.includes('pyramid')) {
        ctx.fillStyle = `rgba(255, 255, 255, 0.2)`;
        ctx.beginPath();
        ctx.moveTo(width * 0.2, height * 0.8);
        ctx.lineTo(width * 0.4, height * 0.4);
        ctx.lineTo(width * 0.6, height * 0.8);
        ctx.closePath();
        ctx.fill();
      }

      if (prompt.includes('star') || prompt.includes('space')) {
        const numStars = 5 + (hash % 10);
        ctx.fillStyle = `rgba(255, 255, 255, 0.6)`;
        for (let i = 0; i < numStars; i++) {
          const x = (hash * (i + 1)) % width;
          const y = (hash * (i + 2)) % height;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    /* -------------------- HELPER METHODS -------------------- */
    buildEnhancedPrompt() {
      let prompt = this.currentPrompt;

      // Add style modifiers
      const styleModifiers = {
        realistic: "photorealistic, high quality, detailed",
        artistic: "artistic, painterly, creative style",
        cartoon: "cartoon style, animated, colorful, digital art",
        "digital-art": "digital art, concept art, detailed illustration",
        photographic: "professional photography, sharp focus, DSLR"
      };

      if (styleModifiers[this.currentStyle]) {
        prompt += `, ${styleModifiers[this.currentStyle]}`;
      }

      return prompt;
    }

    hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash);
    }

    handleRetry() {
      this.retryCount++;
      if (this.retryCount <= this.maxRetries) {
        this.handleGenerate();
      } else {
        this.toast("Maximum retries reached. Try a different prompt or check your API keys.", "error");
      }
    }

    /* -------------------- UI METHODS -------------------- */
    beginGenerationUI() {
      this.isGenerating = true;
      this.retryCount = 0;
      this.toggleGenerateButton(true);
      this.updateProgress(10, "Initializing...");
      if (this.dom.progressContainer) this.dom.progressContainer.classList.remove("hidden");
      if (this.dom.retrySection) this.dom.retrySection.classList.add("hidden");
      if (this.dom.loadingOverlay) this.dom.loadingOverlay.classList.remove("hidden");
    }

    toggleGenerateButton(loading) {
      if (!this.dom.generateBtn) return;
      const spinner = this.dom.generateBtn.querySelector(".loading-spinner");
      const content = this.dom.generateBtn.querySelector(".btn-content");
      if (loading) {
        this.dom.generateBtn.disabled = true;
        if (spinner) spinner.classList.remove("hidden");
        if (content) content.classList.add("hidden");
      } else {
        this.dom.generateBtn.disabled = false;
        if (spinner) spinner.classList.add("hidden");
        if (content) content.classList.remove("hidden");
      }
    }

    updateProgress(percent, text) {
      if (this.dom.progressBar) this.dom.progressBar.style.width = `${percent}%`;
      if (this.dom.progressText) this.dom.progressText.textContent = text;
      if (this.dom.loadingSubtitle) this.dom.loadingSubtitle.textContent = text;
    }

    onGenerationSuccess(images) {
      this.isGenerating = false;
      this.toggleGenerateButton(false);
      if (this.dom.progressContainer) this.dom.progressContainer.classList.add("hidden");
      if (this.dom.loadingOverlay) this.dom.loadingOverlay.classList.add("hidden");
      this.generatedImages.unshift(...images);
      this.updateGallery();
      this.updateHistory();
      this.toast(`Generated ${images.length} image(s) successfully!`, "success");
    }

    onGenerationError(error) {
      console.error("Generation error:", error);
      this.isGenerating = false;
      this.toggleGenerateButton(false);
      if (this.dom.loadingOverlay) this.dom.loadingOverlay.classList.add("hidden");
      if (this.dom.errorMessage) this.dom.errorMessage.textContent = this.mapError(error);
      if (this.dom.retrySection) this.dom.retrySection.classList.remove("hidden");
      this.toast(this.mapError(error), "error");
    }

    mapError(err) {
      const dict = {
        network: "Connection issue. Check your internet and try again.",
        auth: "API authentication failed. Please check your API key.",
        rate_limit: "Too many requests. Please wait before trying again.",
        content_policy: "Prompt may violate content policy. Try rephrasing.",
        server_error: "AI service temporarily unavailable. Trying another service...",
        timeout: "Request timed out. Try again later."
      };
      if (err instanceof APIError) return dict[err.type] || err.message;
      return err.message || "Unexpected error. Please try again.";
    }

    updateGallery() {
      if (!this.dom.galleryGrid) return;
      if (this.generatedImages.length === 0) {
        this.showGalleryPlaceholder();
        return;
      }
      if (this.dom.galleryPlaceholder) this.dom.galleryPlaceholder.classList.add("hidden");
      this.dom.galleryGrid.innerHTML = this.generatedImages
        .map((img) => this.renderCard(img))
        .join("");
    }

    renderCard(img) {
      return `
        <div class="image-card">
          <img src="${img.url}" alt="${this.escapeHtml(img.prompt)}" loading="lazy" />
          <div class="card-body">
            <p class="card-text">${this.escapeHtml(this.truncate(img.prompt, 70))}</p>
            <div class="card-meta"><small class="text-muted">${img.size} • ${img.source}</small></div>
            <div class="card-actions">
              <button class="btn btn--secondary btn--sm" onclick="app.copy('${img.url}')"><i class="bi bi-clipboard"></i> Copy URL</button>
              <button class="btn btn--outline btn--sm" onclick="app.download('${img.url}')"><i class="bi bi-download"></i> Download</button>
            </div>
          </div>
        </div>`;
    }

    showGalleryPlaceholder() {
      if (this.dom.galleryPlaceholder) this.dom.galleryPlaceholder.classList.remove("hidden");
    }

    updateHistory() {
      if (!this.dom.historySection || !this.dom.historyList) return;
      if (!this.promptHistory.includes(this.currentPrompt)) {
        this.promptHistory.unshift(this.currentPrompt);
        if (this.promptHistory.length > 10) this.promptHistory.pop();
      }
      this.dom.historySection.classList.remove("hidden");
      this.dom.historyList.innerHTML = this.promptHistory
        .map((p) => `<div class="history-item" data-prompt="${p}"><i class="bi bi-clock"></i> ${this.escapeHtml(this.truncate(p, 40))}</div>`)
        .join("");
    }

    updateNetworkStatus() {
      if (!this.dom.networkStatus) return;
      if (navigator.onLine) {
        this.dom.networkStatus.classList.remove("offline");
        this.dom.networkStatus.innerHTML = '<i class="bi bi-wifi"></i><span>Online</span>';
      } else {
        this.dom.networkStatus.classList.add("offline");
        this.dom.networkStatus.innerHTML = '<i class="bi bi-wifi-off"></i><span>Offline</span>';
      }
    }

    async copy(url) {
      try {
        await navigator.clipboard.writeText(url);
        this.toast("Copied to clipboard", "success");
      } catch {
        const t = document.createElement("textarea");
        t.value = url;
        document.body.appendChild(t);
        t.select();
        try {
          document.execCommand('copy');
          this.toast("Copied to clipboard", "success");
        } catch {
          this.toast("Copy failed", "error");
        }
        document.body.removeChild(t);
      }
    }

    async download(url) {
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ai-image.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.toast("Image download started", "success");
      } catch {
        this.toast("Download failed", "error");
      }
    }

    toast(msg, type = "info") {
      if (!this.dom.toastContainer) return;
      const toast = document.createElement('div');
      toast.className = `toast toast--${type}`;
      toast.textContent = msg;
      this.dom.toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => {
          if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 350);
      }, 2200);
    }

    escapeHtml(unsafe) {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    truncate(str, n) {
      return (str.length > n) ? str.slice(0, n - 1) + '…' : str;
    }

    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  // Assign globally so HTML onclick works
  window.app = new AIImageGenerator();

})();
