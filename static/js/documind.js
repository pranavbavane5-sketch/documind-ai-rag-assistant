/**
 * DocuMind AI — Modern AI SaaS Client Engine
 * Asynchronous document ingestion, 3-panel workspace, streaming chat answers, and verified citations.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Document Management
    const dropzone = document.getElementById('dmDropzone');
    const fileInput = document.getElementById('dmFileInput');
    const dropzoneIcon = document.getElementById('dmDropzoneIcon');
    const uploadFeedback = document.getElementById('dmUploadFeedback');
    const docListContainer = document.getElementById('dmDocListContainer');
    const docCountBadge = document.getElementById('dmDocCountBadge');
    const mobileDocCount = document.getElementById('dmMobileDocCount');
    const vectorCountBadge = document.getElementById('dmVectorCountBadge');
    const vectorCountText = document.getElementById('dmVectorCountText');
    const listStatus = document.getElementById('dmListStatus');

    // DOM Elements - Chat Workspace
    const chatStream = document.getElementById('dmChatStream');
    const chatForm = document.getElementById('dmChatForm');
    const queryInput = document.getElementById('dmQueryInput');
    const sendBtn = document.getElementById('dmSendBtn');
    const sendBtnText = document.getElementById('dmSendBtnText');
    const sendBtnIcon = document.getElementById('dmSendBtnIcon');
    const welcomeHero = document.getElementById('dmWelcomeHero');
    const clearChatBtn = document.getElementById('dmClearChatBtn');
    const heroUploadBtn = document.getElementById('dmHeroUploadBtn');

    // DOM Elements - Sources Panel
    const sourcesContainer = document.getElementById('dmSourcesContainer');
    const sourcesCountBadge = document.getElementById('dmSourcesCountBadge');
    const mobileSourceCount = document.getElementById('dmMobileSourceCount');
    const activeQueryBanner = document.getElementById('dmActiveQueryBanner');
    const activeQueryText = document.getElementById('dmActiveQueryText');

    // Mobile View Toggle Elements
    const tabBtnDocs = document.getElementById('tabBtnDocs');
    const tabBtnChat = document.getElementById('tabBtnChat');
    const tabBtnSources = document.getElementById('tabBtnSources');
    const colDocs = document.getElementById('colDocs');
    const colChat = document.getElementById('colChat');
    const colSources = document.getElementById('colSources');

    // Theme Switcher (Light Mode default / Dark Mode)
    const themeToggleBtn = document.getElementById('dmThemeToggle');
    const themeIcon = document.getElementById('dmThemeIcon');
    const htmlEl = document.documentElement;

    function applyTheme(theme) {
        htmlEl.setAttribute('data-theme', theme);
        localStorage.setItem('documind-theme', theme);
        if (themeIcon) {
            themeIcon.className = theme === 'dark' ? 'bi bi-sun text-warning' : 'bi bi-moon-stars text-secondary';
        }
        initMermaidTheme(theme);
    }

    const savedTheme = localStorage.getItem('documind-theme') || 'dark';
    applyTheme(savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const current = htmlEl.getAttribute('data-theme') || 'dark';
            const next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next);
        });
    }

    // =========================================================================
    // Diagram Zoom & High-Resolution Viewer Modal
    // =========================================================================
    let currentZoomScale = 1.0;
    const zoomModalEl = document.getElementById('dmDiagramZoomModal');
    const zoomModalBody = document.getElementById('dmDiagramZoomModalBody');
    const zoomInBtn = document.getElementById('dmZoomInBtn');
    const zoomOutBtn = document.getElementById('dmZoomOutBtn');
    const zoomResetBtn = document.getElementById('dmZoomResetBtn');

    function openDiagramZoomModal(svgHtml, title) {
        if (!zoomModalEl || !zoomModalBody) return;
        const titleEl = document.getElementById('dmDiagramZoomModalLabel');
        if (titleEl) titleEl.textContent = title || 'Visual Diagram Inspection';
        currentZoomScale = 1.0;
        zoomModalBody.innerHTML = `<div id="dmZoomTarget" style="display:inline-block; transform: scale(1); transform-origin: top center; transition: transform 0.2s ease;">${svgHtml}</div>`;
        const modal = bootstrap.Modal.getOrCreateInstance(zoomModalEl);
        modal.show();
    }

    if (zoomInBtn) {
        zoomInBtn.onclick = () => {
            currentZoomScale = Math.min(currentZoomScale + 0.25, 3.0);
            const target = document.getElementById('dmZoomTarget');
            if (target) target.style.transform = `scale(${currentZoomScale})`;
        };
    }
    if (zoomOutBtn) {
        zoomOutBtn.onclick = () => {
            currentZoomScale = Math.max(currentZoomScale - 0.25, 0.5);
            const target = document.getElementById('dmZoomTarget');
            if (target) target.style.transform = `scale(${currentZoomScale})`;
        };
    }
    if (zoomResetBtn) {
        zoomResetBtn.onclick = () => {
            currentZoomScale = 1.0;
            const target = document.getElementById('dmZoomTarget');
            if (target) target.style.transform = 'scale(1)';
        };
    }

    function initMermaidTheme(theme) {
        if (window.mermaid) {
            try {
                window.mermaid.initialize({
                    startOnLoad: false,
                    theme: theme === 'dark' ? 'dark' : 'default',
                    securityLevel: 'loose',
                    fontFamily: 'Plus Jakarta Sans, -apple-system, sans-serif'
                });
            } catch (e) {
                console.warn('Mermaid initialization warning:', e);
            }
        }
    }
    initMermaidTheme(savedTheme);

    async function renderMermaidDiagram(containerEl, mermaidCode, id) {
        if (!window.mermaid || !containerEl) return;
        try {
            const cleanCode = mermaidCode.trim();
            const renderId = 'dm-svg-' + (id || Date.now());
            const { svg } = await window.mermaid.render(renderId, cleanCode);
            containerEl.innerHTML = svg;
        } catch (err) {
            console.warn('Mermaid rendering syntax error:', err);
            containerEl.innerHTML = `
                <div class="alert alert-warning small py-2 px-3">
                    <div class="d-flex align-items-center gap-1 text-warning fw-semibold small mb-1">
                        <i class="bi bi-exclamation-triangle-fill"></i> Diagram Formatting Fallback
                    </div>
                    <pre class="m-0 mt-1"><code>${escapeHtml(mermaidCode)}</code></pre>
                </div>
            `;
        }
    }

    function renderChartJs(canvasEl, chartConfig) {
        if (!window.Chart || !canvasEl) return;
        try {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const textColor = isDark ? '#E2E8F0' : '#1E293B';
            const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

            const cfg = JSON.parse(JSON.stringify(chartConfig));
            cfg.options = cfg.options || {};
            cfg.options.responsive = true;
            cfg.options.maintainAspectRatio = false;
            cfg.options.color = textColor;
            cfg.options.plugins = cfg.options.plugins || {};
            if (cfg.options.plugins.legend) {
                cfg.options.plugins.legend.labels = cfg.options.plugins.legend.labels || {};
                cfg.options.plugins.legend.labels.color = textColor;
            }
            if (cfg.options.plugins.title) {
                cfg.options.plugins.title.color = textColor;
            }
            if (cfg.options.scales) {
                Object.keys(cfg.options.scales).forEach(axis => {
                    cfg.options.scales[axis].ticks = cfg.options.scales[axis].ticks || {};
                    cfg.options.scales[axis].ticks.color = textColor;
                    cfg.options.scales[axis].grid = cfg.options.scales[axis].grid || {};
                    cfg.options.scales[axis].grid.color = gridColor;
                });
            }

            new window.Chart(canvasEl, cfg);
        } catch (err) {
            console.warn('Chart.js render error:', err);
            if (canvasEl.parentElement) {
                canvasEl.parentElement.innerHTML = `
                    <div class="alert alert-warning small py-2 px-3">
                        <i class="bi bi-exclamation-circle me-1"></i> Could not display chart: ${escapeHtml(err.message)}
                    </div>
                `;
            }
        }
    }

    // =========================================================================
    // Multilingual Prompts Configuration
    // =========================================================================
    const LANG_CONFIG = {
        en: {
            code: 'en',
            label: 'English',
            locale: 'en-IN',
            fallbackLocales: ['en-US', 'en-GB', 'en'],
            quickPrompts: {
                summarize: 'Summarize this document and highlight its core concepts and key takeaways.',
                key_findings: 'What are the key findings, definitions, and concepts explained in the text?',
                explain_simply: 'Explain the main concepts of this document in clear, easy to understand terms.',
                conclusions: 'What are the main conclusions and practical applications discussed?'
            },
            suggestedChips: [
                { icon: 'bi-file-earmark-text', text: 'Summarize this document', prompt: 'Summarize this document and highlight its core concepts and key takeaways.' },
                { icon: 'bi-lightbulb', text: 'Find the key insights', prompt: 'What are the key findings, definitions, and concepts explained in the text?' },
                { icon: 'bi-compass', text: 'Explain the main concepts', prompt: 'Explain the main concepts of this document in clear, easy to understand terms.' },
                { icon: 'bi-check2-circle', text: 'What are the conclusions?', prompt: 'What are the main conclusions and practical applications discussed?' }
            ],
            listeningText: 'Listening in English (en-IN)... Speak your question',
            noSpeechMsg: 'No speech was detected. Please click the mic and try again.'
        },
        hi: {
            code: 'hi',
            label: 'हिन्दी (Hindi)',
            locale: 'hi-IN',
            fallbackLocales: ['hi'],
            quickPrompts: {
                summarize: 'इस दस्तावेज़ का एक व्यापक सारांश प्रस्तुत करें और इसके मुख्य निष्कर्ष और महत्वपूर्ण बिंदु बताएं।',
                key_findings: 'इस दस्तावेज़ में समझाए गए मुख्य निष्कर्ष, परिभाषाएँ और मूल अवधारणाएँ क्या हैं?',
                explain_simply: 'इस दस्तावेज़ के मुख्य विषय को सरल शब्दों में आसानी से समझाएं।',
                conclusions: 'इस दस्तावेज़ के मुख्य निष्कर्ष और व्यावहारिक अनुप्रयोग क्या हैं?'
            },
            suggestedChips: [
                { icon: 'bi-file-earmark-text', text: 'दस्तावेज़ का सारांश दें', prompt: 'इस दस्तावेज़ का एक व्यापक सारांश प्रस्तुत करें और इसके मुख्य निष्कर्ष और महत्वपूर्ण बिंदु बताएं।' },
                { icon: 'bi-lightbulb', text: 'मुख्य निष्कर्ष क्या हैं?', prompt: 'इस दस्तावेज़ में समझाए गए मुख्य निष्कर्ष, परिभाषाएँ और मूल अवधारणाएँ क्या हैं?' },
                { icon: 'bi-compass', text: 'मूल अवधारणाएं समझाएं', prompt: 'इस दस्तावेज़ के मुख्य विषय को सरल शब्दों में आसानी से समझाएं।' },
                { icon: 'bi-check2-circle', text: 'मुख्य निष्कर्ष और परिणाम', prompt: 'इस दस्तावेज़ के मुख्य निष्कर्ष और व्यावहारिक अनुप्रयोग क्या हैं?' }
            ],
            listeningText: 'हिन्दी में सुन रहे हैं (hi-IN)... अपना प्रश्न बोलें',
            noSpeechMsg: 'कोई आवाज़ नहीं सुनाई दी। कृपया माइक पर दोबारा क्लिक करें।'
        },
        mr: {
            code: 'mr',
            label: 'मराठी (Marathi)',
            locale: 'mr-IN',
            fallbackLocales: ['mr', 'hi-IN'],
            quickPrompts: {
                summarize: 'या दस्तऐवजाचा सर्वसमावेशक सारांश द्या आणि त्यातील मुख्य संकल्पना व निष्कर्ष स्पष्ट करा.',
                key_findings: 'दस्तऐवजातील प्रमुख निष्कर्ष, व्याख्या आणि महत्त्वाच्या संकल्पना कोणत्या आहेत?',
                explain_simply: 'या दस्तऐवजाचा मुख्य विषय सोप्या भाषेत समजावून सांगा.',
                conclusions: 'या दस्तऐवजाचे मुख्य निष्कर्ष आणि व्यावहारिक उपयोग काय आहेत?'
            },
            suggestedChips: [
                { icon: 'bi-file-earmark-text', text: 'दस्तऐवजाचा सारांश द्या', prompt: 'या दस्तऐवजाचा सर्वसमावेशक सारांश द्या आणि त्यातील मुख्य संकल्पना व निष्कर्ष स्पष्ट करा.' },
                { icon: 'bi-lightbulb', text: 'प्रमुख निष्कर्ष कोणते आहेत?', prompt: 'दस्तऐवजातील प्रमुख निष्कर्ष, व्याख्या आणि महत्त्वाच्या संकल्पना कोणत्या आहेत?' },
                { icon: 'bi-compass', text: 'मुख्य संकल्पना स्पष्ट करा', prompt: 'या दस्तऐवजाचा मुख्य विषय सोप्या भाषेत समजावून सांगा.' },
                { icon: 'bi-check2-circle', text: 'मुख्य निष्कर्ष काय आहेत?', prompt: 'या दस्तऐवजाचे मुख्य निष्कर्ष आणि व्यावहारिक उपयोग काय आहेत?' }
            ],
            listeningText: 'मराठीत ऐकत आहे (mr-IN)... आपला प्रश्न बोला',
            noSpeechMsg: 'कोणताही आवाज ऐकू आला नाही. कृपया माइकवर पुन्हा क्लिक करा.'
        }
    };

    let currentLanguage = localStorage.getItem('documind-lang') || 'en';

    function setLanguage(langCode) {
        if (!LANG_CONFIG[langCode]) langCode = 'en';
        currentLanguage = langCode;
        localStorage.setItem('documind-lang', langCode);

        const cfg = LANG_CONFIG[langCode];

        document.querySelectorAll('.dm-lang-opt').forEach(opt => {
            opt.classList.toggle('active', opt.getAttribute('data-lang') === langCode);
        });

        const langLabel = document.getElementById('dmSelectedLangLabel');
        if (langLabel) langLabel.textContent = cfg.label;

        updatePromptChips(langCode);
    }

    document.querySelectorAll('.dm-lang-opt').forEach(opt => {
        opt.addEventListener('click', () => {
            const lang = opt.getAttribute('data-lang');
            setLanguage(lang);
            showToast(`Language set to ${LANG_CONFIG[lang].label}`, 'info');
        });
    });

    // =========================================================================
    // Text-to-Speech (TTS) Engine
    // =========================================================================
    let currentSpeakingBtn = null;

    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
        };
    }

    function cleanTextForSpeech(text) {
        if (!text) return '';
        let clean = text;
        clean = clean.replace(/```[\s\S]*?```/g, ' ');
        clean = clean.replace(/`([^`]+)`/g, '$1');
        clean = clean.replace(/\[(?:Doc|Page|Chunk)[^\]]*\]/gi, ' ');
        clean = clean.replace(/^#{1,6}\s+/gm, ' ');
        clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
        clean = clean.replace(/\*([^*]+)\*/g, '$1');
        clean = clean.replace(/__([^_]+)__/g, '$1');
        clean = clean.replace(/_([^_]+)_/g, '$1');
        clean = clean.replace(/^[\s*-•\d+.]+/gm, ' ');
        clean = clean.replace(/https?:\/\/\S+/g, ' ');
        clean = clean.replace(/<[^>]+>/g, ' ');
        clean = clean.replace(/\s+/g, ' ').trim();
        return clean;
    }

    function stopSpeaking() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        if (currentSpeakingBtn) {
            currentSpeakingBtn.classList.remove('is-speaking');
            const icon = currentSpeakingBtn.querySelector('.dm-tts-icon');
            if (icon) icon.className = 'bi bi-volume-up dm-tts-icon';
            const label = currentSpeakingBtn.querySelector('.dm-tts-label');
            if (label) label.textContent = 'Listen';
            currentSpeakingBtn = null;
        }
    }

    function speakText(rawText, langCode, buttonEl) {
        if (!('speechSynthesis' in window)) {
            showToast('Text-to-speech is not supported in this browser.', 'warning');
            return;
        }

        if (currentSpeakingBtn === buttonEl && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
            stopSpeaking();
            return;
        }

        stopSpeaking();

        const clean = cleanTextForSpeech(rawText);
        if (!clean) {
            showToast('No readable text to speak.', 'warning');
            return;
        }

        const utterance = new SpeechSynthesisUtterance(clean);
        const voices = window.speechSynthesis.getVoices() || [];
        const cfg = LANG_CONFIG[langCode] || LANG_CONFIG.en;

        let selectedVoice = voices.find(v => v.lang && v.lang.toLowerCase() === cfg.locale.toLowerCase()) ||
                            voices.find(v => v.lang && v.lang.toLowerCase().startsWith(cfg.code.toLowerCase()));

        if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang;
        } else {
            utterance.lang = cfg.locale;
        }

        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
            currentSpeakingBtn = buttonEl;
            currentSpeakingBtn.classList.add('is-speaking');
            const icon = currentSpeakingBtn.querySelector('.dm-tts-icon');
            if (icon) icon.className = 'bi bi-stop-circle text-danger dm-tts-icon';
            const label = currentSpeakingBtn.querySelector('.dm-tts-label');
            if (label) label.textContent = 'Stop';
        };

        utterance.onend = () => stopSpeaking();
        utterance.onerror = () => stopSpeaking();

        window.speechSynthesis.speak(utterance);
    }

    // Helper: CSRF Token
    function getCsrfToken() {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('csrftoken='));
        return cookie ? cookie.split('=')[1] : (document.querySelector('[name=csrfmiddlewaretoken]')?.value || '');
    }

    // Helper: Escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.innerText = text;
        return div.innerHTML;
    }

    // Lightweight Markdown Formatter
    function formatMarkdown(rawText) {
        if (!rawText) return '';
        
        let safe = escapeHtml(rawText);

        // Code blocks: ```language ... ```
        safe = safe.replace(/```(?:[a-zA-Z0-9_\-]+)?\n([\s\S]*?)```/g, (match, code) => {
            return `<pre class="dm-code-block"><code>${code.trim()}</code></pre>`;
        });

        // Inline code: `code`
        safe = safe.replace(/`([^`]+)`/g, '<code class="dm-inline-code">$1</code>');

        // Headers
        safe = safe.replace(/^### (.*$)/gim, '<h5 class="fw-bold mt-2 mb-1">$1</h5>');
        safe = safe.replace(/^## (.*$)/gim, '<h4 class="fw-bold mt-3 mb-2">$1</h4>');
        safe = safe.replace(/^# (.*$)/gim, '<h3 class="fw-bold mt-3 mb-2">$1</h3>');

        // Bold & Italic
        safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Unordered lists
        safe = safe.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
        safe = safe.replace(/(<li>.*<\/li>)/gms, '<ul class="my-1">$1</ul>');

        // Ordered lists
        safe = safe.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li>$2</li>');

        // Paragraph breaks
        safe = safe.replace(/\n\n+/g, '</p><p>');
        safe = safe.replace(/\n/g, '<br>');

        return `<p>${safe}</p>`;
    }

    function scrollChatToBottom() {
        if (chatStream) {
            chatStream.scrollTop = chatStream.scrollHeight;
        }
    }

    // Auto-expand textarea height
    if (queryInput) {
        queryInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });

        queryInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                chatForm.dispatchEvent(new Event('submit'));
            }
        });
    }

    // Clear Chat Action
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            const messages = chatStream.querySelectorAll('.dm-message-row');
            messages.forEach(m => m.remove());
            if (welcomeHero) {
                welcomeHero.classList.remove('d-none');
            }
            renderSourcesPanel([], '');
            showToast('Chat conversation cleared.', 'info');
        });
    }

    // Hero "Upload First Document" Click Handler
    if (heroUploadBtn && fileInput) {
        heroUploadBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }

    const heroTriggerUpload = document.getElementById('dmHeroTriggerUpload');
    if (heroTriggerUpload && fileInput) {
        heroTriggerUpload.addEventListener('click', () => {
            fileInput.click();
        });
    }

    // =========================================================================
    // Responsive Mobile 3-Tab Switcher (< 992px)
    // =========================================================================
    function initMobileTabs() {
        if (!tabBtnDocs || !tabBtnChat || !tabBtnSources) return;

        function setMobileTab(activeTab) {
            if (window.innerWidth >= 992) {
                colDocs?.classList.remove('active-mobile-panel');
                colChat?.classList.remove('active-mobile-panel');
                colSources?.classList.remove('active-mobile-panel');
                return;
            }

            tabBtnDocs.classList.toggle('active', activeTab === 'docs');
            tabBtnChat.classList.toggle('active', activeTab === 'chat');
            tabBtnSources.classList.toggle('active', activeTab === 'sources');

            colDocs?.classList.toggle('active-mobile-panel', activeTab === 'docs');
            colChat?.classList.toggle('active-mobile-panel', activeTab === 'chat');
            colSources?.classList.toggle('active-mobile-panel', activeTab === 'sources');
        }

        tabBtnDocs.addEventListener('click', () => setMobileTab('docs'));
        tabBtnChat.addEventListener('click', () => setMobileTab('chat'));
        tabBtnSources.addEventListener('click', () => setMobileTab('sources'));

        if (window.innerWidth < 992) {
            const docCount = document.querySelectorAll('.dm-document-card').length;
            setMobileTab(docCount > 0 ? 'chat' : 'docs');
        }

        window.addEventListener('resize', () => {
            if (window.innerWidth >= 992) {
                colDocs?.classList.remove('active-mobile-panel');
                colChat?.classList.remove('active-mobile-panel');
                colSources?.classList.remove('active-mobile-panel');
            }
        });
    }
    initMobileTabs();

    // =========================================================================
    // Suggested Prompts Binding (4 Exact Prompts)
    // =========================================================================
    function bindPromptChips() {
        document.querySelectorAll('.dm-pill-chip').forEach(chip => {
            chip.onclick = () => {
                const promptText = chip.getAttribute('data-prompt');
                if (queryInput) {
                    queryInput.value = promptText;
                    queryInput.dispatchEvent(new Event('input'));
                    if (window.innerWidth < 992 && tabBtnChat) {
                        tabBtnChat.click();
                    }
                    chatForm.dispatchEvent(new Event('submit'));
                }
            };
        });
    }

    function updatePromptChips(langCode) {
        const chipsContainer = document.getElementById('dmPromptChipsContainer');
        if (!chipsContainer) return;

        const cfg = LANG_CONFIG[langCode] || LANG_CONFIG.en;
        chipsContainer.innerHTML = '';

        cfg.suggestedChips.forEach(chip => {
            const btn = document.createElement('button');
            btn.className = 'dm-pill-chip';
            btn.setAttribute('data-prompt', chip.prompt);
            btn.innerHTML = `<i class="bi ${chip.icon} text-primary"></i> <span>${escapeHtml(chip.text)}</span>`;
            chipsContainer.appendChild(btn);
        });

        bindPromptChips();
    }

    setLanguage(currentLanguage);

    // =========================================================================
    // Quick Actions Bar (Bottom of chat)
    // =========================================================================
    function initQuickActions() {
        const quickBar = document.getElementById('dmQuickActionsBar');
        if (!quickBar) return;

        quickBar.querySelectorAll('.dm-quick-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                const cfg = LANG_CONFIG[currentLanguage] || LANG_CONFIG.en;
                const promptText = cfg.quickPrompts[action];
                if (promptText && queryInput) {
                    queryInput.value = promptText;
                    queryInput.dispatchEvent(new Event('input'));
                    if (window.innerWidth < 992 && tabBtnChat) {
                        tabBtnChat.click();
                    }
                    chatForm.dispatchEvent(new Event('submit'));
                }
            });
        });
    }
    initQuickActions();

    // =========================================================================
    // Speech Recognition (Microphone Input)
    // =========================================================================
    let recognition = null;
    let isListening = false;
    let accumulatedTranscript = '';

    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const micBtn = document.getElementById('dmMicBtn');
        const voiceBanner = document.getElementById('dmVoiceRecorderBar');
        const voiceStatusText = document.getElementById('dmVoiceStatusText');
        const stopBtn = document.getElementById('dmVoiceStopBtn');
        const cancelBtn = document.getElementById('dmVoiceCancelBtn');

        if (!micBtn) return;

        if (!SpeechRecognition) {
            micBtn.title = "Voice recognition is not supported in this browser.";
            micBtn.classList.add('opacity-50');
            micBtn.onclick = () => {
                showToast("Speech recognition is not supported in this browser. Please type your query.", "warning");
            };
            return;
        }

        function createRecognitionInstance() {
            const rec = new SpeechRecognition();
            rec.continuous = true;
            rec.interimResults = true;
            rec.maxAlternatives = 1;
            const cfg = LANG_CONFIG[currentLanguage] || LANG_CONFIG.en;
            rec.lang = cfg.locale;

            rec.onstart = () => {
                isListening = true;
                micBtn.classList.add('is-listening');
                if (voiceBanner) voiceBanner.classList.remove('d-none');
                if (voiceStatusText) voiceStatusText.textContent = cfg.listeningText;
            };

            rec.onresult = (event) => {
                let interim = '';
                let finalPiece = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalPiece += event.results[i][0].transcript;
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }

                if (finalPiece) {
                    accumulatedTranscript = (accumulatedTranscript ? accumulatedTranscript + ' ' : '') + finalPiece.trim();
                }

                const combined = (accumulatedTranscript + (interim ? ' ' + interim : '')).trim();
                if (queryInput && combined) {
                    queryInput.value = combined;
                    queryInput.dispatchEvent(new Event('input'));
                }
            };

            rec.onerror = (event) => {
                console.warn('SpeechRecognition error:', event.error);
                if (event.error === 'not-allowed') {
                    showToast('Microphone access denied. Please allow microphone permission.', 'danger');
                    cleanupListening(false);
                } else if (event.error === 'no-speech') {
                    showToast(LANG_CONFIG[currentLanguage].noSpeechMsg, 'warning');
                } else {
                    showToast('Voice error: ' + event.error, 'warning');
                }
            };

            rec.onend = () => {
                if (isListening) cleanupListening(true);
            };

            return rec;
        }

        function startListening() {
            if (isListening) {
                stopListening(true);
                return;
            }

            accumulatedTranscript = queryInput ? queryInput.value.trim() : '';
            try {
                recognition = createRecognitionInstance();
                recognition.start();
            } catch (err) {
                console.warn('Start voice error:', err);
                showToast('Could not start voice recognition.', 'warning');
            }
        }

        function stopListening(keepText = true) {
            if (recognition) {
                try { recognition.stop(); } catch (e) {}
            }
            cleanupListening(keepText);
        }

        function cleanupListening(keepText = true) {
            isListening = false;
            micBtn.classList.remove('is-listening');
            if (voiceBanner) voiceBanner.classList.add('d-none');
            if (!keepText && queryInput) {
                queryInput.value = '';
                queryInput.dispatchEvent(new Event('input'));
            }
            recognition = null;
        }

        micBtn.onclick = () => startListening();
        if (stopBtn) stopBtn.onclick = () => stopListening(true);
        if (cancelBtn) cancelBtn.onclick = () => stopListening(false);
    }
    initSpeechRecognition();

    // =========================================================================
    // Document Upload Handling
    // =========================================================================
    if (dropzone && fileInput) {
        dropzone.addEventListener('click', (e) => {
            if (e.target !== fileInput) {
                fileInput.click();
            }
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('dragover');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                handleFileUpload(files[0]);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files.length > 0) {
                handleFileUpload(fileInput.files[0]);
            }
        });
    }

    async function handleFileUpload(file) {
        if (!file) return;

        // Validation on frontend
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!['.pdf', '.txt'].includes(ext)) {
            showToast('Invalid file format. Please upload a PDF or TXT file.', 'danger');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            showToast('File exceeds the 10 MB maximum limit.', 'danger');
            return;
        }

        if (uploadFeedback) {
            uploadFeedback.classList.remove('d-none');
            uploadFeedback.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <span class="dm-spinner-sm text-primary"></span>
                    <div class="flex-grow-1">
                        <div class="fw-semibold text-truncate small">${escapeHtml(file.name)}</div>
                        <div class="text-secondary" style="font-size: 0.72rem;">Extracting text & indexing into ChromaDB...</div>
                    </div>
                </div>
            `;
        }

        if (dropzoneIcon) {
            dropzoneIcon.innerHTML = `<span class="dm-spinner-sm"></span>`;
        }

        const formData = new FormData();
        formData.append('document', file);

        try {
            const response = await fetch('/api/upload/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCsrfToken()
                },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                uploadFeedback.innerHTML = `
                    <div class="text-success d-flex align-items-center gap-1 small">
                        <i class="bi bi-check-circle-fill"></i> Successfully indexed into ${data.document.chunks} vector chunks.
                    </div>
                `;
                setTimeout(() => uploadFeedback.classList.add('d-none'), 3500);

                appendDocumentCard(data.document);
                updateDocumentState(data.total_vectors);

                showToast(`Indexed: ${data.document.name}`, 'success');
            } else {
                uploadFeedback.innerHTML = `
                    <div class="text-danger d-flex align-items-center gap-1 small">
                        <i class="bi bi-exclamation-triangle-fill"></i> ${escapeHtml(data.error || 'Upload failed')}
                    </div>
                `;
                showToast(data.error || 'Upload error', 'danger');
            }
        } catch (err) {
            uploadFeedback.innerHTML = `
                <div class="text-danger small">Network error during document upload.</div>
            `;
            showToast('Network error while processing file.', 'danger');
        } finally {
            fileInput.value = '';
            if (dropzoneIcon) {
                dropzoneIcon.innerHTML = `<i class="bi bi-cloud-arrow-up"></i>`;
            }
        }
    }

    function updateDocumentState(totalVectors) {
        const count = document.querySelectorAll('.dm-document-card').length;
        if (docCountBadge) {
            docCountBadge.textContent = `${count} file${count === 1 ? '' : 's'}`;
        }
        if (mobileDocCount) {
            mobileDocCount.textContent = count;
        }
        if (listStatus) {
            listStatus.textContent = count > 0 ? 'Ready to query' : 'Awaiting files';
        }
        if (vectorCountText && totalVectors !== undefined) {
            vectorCountText.textContent = `${totalVectors} Vectors`;
        }

        // Switch empty state hero to ready state
        if (count > 0 && welcomeHero && welcomeHero.querySelector('#dmHeroEmptyDocs')) {
            welcomeHero.innerHTML = `
                <div id="dmHeroWithDocs">
                    <div class="dm-welcome-hero-icon">
                        <i class="bi bi-chat-quote"></i>
                    </div>
                    <h1 class="dm-welcome-title">Chat with your Documents</h1>
                    <div class="dm-welcome-subtitle">
                        Ask questions and get instant, grounded answers with exact source citations from your uploaded files.
                    </div>
                    <div class="dm-chips-label text-muted small mb-2 fw-medium">Suggested queries:</div>
                    <div class="d-flex flex-wrap justify-content-center gap-2" id="dmPromptChipsContainer">
                    </div>
                </div>
            `;
            updatePromptChips(currentLanguage);
        }
    }

    function appendDocumentCard(doc) {
        const emptyMsg = document.getElementById('dmEmptyDocsMessage');
        if (emptyMsg) {
            emptyMsg.remove();
        }

        const isPdf = doc.type === '.pdf' || doc.name.endsWith('.pdf');
        const badgeClass = isPdf ? 'badge-pdf' : 'badge-txt';
        const badgeText = isPdf ? 'PDF' : 'TXT';
        const pageBadge = doc.pages > 0 ? `<span>&bull; ${doc.pages} page${doc.pages === 1 ? '' : 's'}</span>` : '';

        const card = document.createElement('div');
        card.className = 'dm-document-card d-flex justify-content-between align-items-center';
        card.id = `dm-doc-${doc.id}`;
        card.innerHTML = `
            <div class="text-truncate me-2">
                <div class="d-flex align-items-center gap-2 mb-1">
                    <span class="dm-file-badge ${badgeClass}">${badgeText}</span>
                    <span class="fw-semibold text-truncate small dm-doc-title" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</span>
                </div>
                <div class="d-flex align-items-center gap-2 dm-doc-meta">
                    <span><i class="bi bi-grid-3x3-gap me-1 text-primary"></i>${doc.chunks} chunks</span>
                    ${pageBadge}
                    <span>&bull; ${doc.size || ''}</span>
                </div>
            </div>
            <div class="d-flex align-items-center gap-1 flex-shrink-0">
                <button class="btn btn-doc-action btn-summarize-doc" data-name="${escapeHtml(doc.name)}" title="Summarize this document">
                    <i class="bi bi-lightning-charge"></i>
                </button>
                <button class="btn btn-doc-action btn-replace-doc" data-id="${doc.id}" data-name="${escapeHtml(doc.name)}" title="Replace document">
                    <i class="bi bi-arrow-repeat"></i>
                </button>
                <button class="btn btn-doc-action btn-delete btn-delete-doc" data-id="${doc.id}" title="Delete file and vector embeddings">
                    <i class="bi bi-trash3"></i>
                </button>
            </div>
        `;

        docListContainer.prepend(card);
        attachActionListeners(card);
    }

    function attachActionListeners(container) {
        // Delete action
        const deleteBtn = container.querySelector('.btn-delete-doc');
        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                const docId = deleteBtn.getAttribute('data-id');
                if (!confirm('Are you sure you want to remove this document and purge its vector embeddings from ChromaDB?')) {
                    return;
                }

                try {
                    deleteBtn.disabled = true;
                    deleteBtn.innerHTML = '<span class="dm-spinner-sm"></span>';

                    const response = await fetch(`/api/delete/${docId}/`, {
                        method: 'POST',
                        headers: {
                            'X-CSRFToken': getCsrfToken()
                        }
                    });
                    const data = await response.json();

                    if (data.success) {
                        const card = document.getElementById(`dm-doc-${docId}`);
                        if (card) {
                            card.style.opacity = '0';
                            card.style.transform = 'scale(0.97)';
                            setTimeout(() => {
                                card.remove();
                                const remaining = document.querySelectorAll('.dm-document-card').length;
                                updateDocumentState(data.total_vectors);

                                if (remaining === 0) {
                                    docListContainer.innerHTML = `
                                        <div class="text-center py-5 dm-empty-docs-box" id="dmEmptyDocsMessage">
                                            <div class="dm-empty-circle mx-auto mb-2">
                                                <i class="bi bi-folder-plus text-primary fs-3"></i>
                                            </div>
                                            <div class="fw-bold dm-empty-title">No documents uploaded yet</div>
                                            <div class="dm-empty-subtitle mt-1">Upload a PDF or TXT above to build your vector knowledge base.</div>
                                        </div>
                                    `;

                                    if (welcomeHero) {
                                        welcomeHero.innerHTML = `
                                            <div id="dmHeroEmptyDocs">
                                                <div class="dm-welcome-hero-icon">
                                                    <i class="bi bi-cloud-arrow-up"></i>
                                                </div>
                                                <h1 class="dm-welcome-title">Welcome to DocuMind AI</h1>
                                                <div class="dm-welcome-subtitle">
                                                    Chat with your documents. Discover insights instantly. Upload a PDF or text file on the left to start.
                                                </div>
                                                <button type="button" class="btn btn-primary rounded-pill px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2" id="dmHeroUploadBtn">
                                                    <i class="bi bi-cloud-arrow-up"></i> Upload Your First Document
                                                </button>
                                            </div>
                                        `;
                                        const newUploadBtn = document.getElementById('dmHeroUploadBtn');
                                        if (newUploadBtn && fileInput) {
                                            newUploadBtn.onclick = () => fileInput.click();
                                        }
                                    }
                                }
                            }, 180);
                        }
                        showToast('Document and vector embeddings deleted.', 'info');
                    } else {
                        deleteBtn.disabled = false;
                        deleteBtn.innerHTML = '<i class="bi bi-trash3"></i>';
                        showToast(data.error || 'Failed to delete document', 'danger');
                    }
                } catch (err) {
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = '<i class="bi bi-trash3"></i>';
                    showToast('Server communication error.', 'danger');
                }
            };
        }

        // Replace action
        const replaceBtn = container.querySelector('.btn-replace-doc');
        if (replaceBtn) {
            replaceBtn.onclick = () => {
                const docName = replaceBtn.getAttribute('data-name');
                showToast(`Select a replacement PDF or TXT for '${docName}'.`, 'info');
                if (fileInput) fileInput.click();
            };
        }

        // Summarize action
        const summarizeBtn = container.querySelector('.btn-summarize-doc');
        if (summarizeBtn) {
            summarizeBtn.onclick = () => {
                const docName = summarizeBtn.getAttribute('data-name');
                if (queryInput) {
                    queryInput.value = `Provide a structured summary of ${docName}, highlighting core concepts, main findings, and key takeaways.`;
                    queryInput.dispatchEvent(new Event('input'));
                    if (window.innerWidth < 992 && tabBtnChat) {
                        tabBtnChat.click();
                    }
                    chatForm.dispatchEvent(new Event('submit'));
                }
            };
        }
    }

    document.querySelectorAll('.dm-document-card').forEach(attachActionListeners);

    // =========================================================================
    // Panel C: Render Sources & Citations Panel
    // =========================================================================
    function renderSourcesPanel(sources, query) {
        if (!sourcesContainer) return;

        if (!sources || sources.length === 0) {
            sourcesContainer.innerHTML = `
                <div class="text-center py-5 dm-empty-sources-box" id="dmEmptySourcesMessage">
                    <div class="dm-empty-circle mx-auto mb-2">
                        <i class="bi bi-card-text text-secondary fs-3"></i>
                    </div>
                    <div class="fw-bold dm-empty-title">No sources retrieved yet</div>
                    <div class="dm-empty-subtitle mt-1">Ask a question to view retrieved passages, relevance scores, and verifiable page citations.</div>
                </div>
            `;
            if (sourcesCountBadge) sourcesCountBadge.textContent = '0 passages';
            if (mobileSourceCount) mobileSourceCount.textContent = '0';
            if (activeQueryBanner) activeQueryBanner.classList.add('d-none');
            return;
        }

        if (sourcesCountBadge) {
            sourcesCountBadge.textContent = `${sources.length} passage${sources.length === 1 ? '' : 's'}`;
        }
        if (mobileSourceCount) {
            mobileSourceCount.textContent = sources.length;
        }
        if (activeQueryBanner && activeQueryText) {
            activeQueryText.textContent = query || 'Recent question';
            activeQueryBanner.classList.remove('d-none');
        }

        sourcesContainer.innerHTML = '';

        sources.forEach((s, idx) => {
            const bodyId = 'dm-src-body-' + idx + '-' + Date.now();
            const pageText = s.page ? `Page ${s.page}` : '';
            const matchScore = s.relevance_score || 85;
            const chunkIndex = s.chunk_index || (idx + 1);
            const isPdf = (s.filename || '').toLowerCase().endsWith('.pdf');

            const card = document.createElement('div');
            card.className = 'dm-source-panel-card is-expanded';
            card.innerHTML = `
                <div class="dm-source-card-header" data-bs-toggle="collapse" data-bs-target="#${bodyId}" aria-expanded="true">
                    <div class="d-flex align-items-center gap-2 text-truncate me-2">
                        <i class="bi ${isPdf ? 'bi-file-earmark-pdf text-danger' : 'bi-file-earmark-text text-primary'}"></i>
                        <span class="dm-source-title text-truncate" title="${escapeHtml(s.filename)}">${escapeHtml(s.filename)}</span>
                    </div>
                    <div class="dm-source-meta-pills">
                        ${pageText ? `<span class="dm-pill-page">${pageText}</span>` : ''}
                        <span class="dm-pill-match">${matchScore}% Match</span>
                        <i class="bi bi-chevron-down text-muted" style="font-size: 0.72rem;"></i>
                    </div>
                </div>
                <div class="collapse show" id="${bodyId}">
                    <div class="dm-source-card-body">
                        <div class="dm-source-passage-text">${escapeHtml(s.text)}</div>
                        <div class="dm-source-footer-actions">
                            <span>Chunk #${chunkIndex}</span>
                            <button type="button" class="dm-copy-passage-btn copy-passage-btn" data-text="${encodeURIComponent(s.text)}">
                                <i class="bi bi-clipboard"></i> Copy passage
                            </button>
                        </div>
                    </div>
                </div>
            `;
            sourcesContainer.appendChild(card);
        });

        // Bind copy passage buttons
        sourcesContainer.querySelectorAll('.copy-passage-btn').forEach(btn => {
            btn.onclick = () => {
                const passage = decodeURIComponent(btn.getAttribute('data-text'));
                navigator.clipboard.writeText(passage);
                btn.innerHTML = '<i class="bi bi-check2 text-success"></i> Copied!';
                setTimeout(() => {
                    btn.innerHTML = '<i class="bi bi-clipboard"></i> Copy passage';
                }, 2000);
            };
        });
    }

    // =========================================================================
    // Chat Query & Grounded Synthesis
    // =========================================================================
    async function submitQuery(queryText, forceVisual = false) {
        const query = (queryText || '').trim();
        if (!query) return;

        // Hide welcome hero on initial question
        if (welcomeHero) {
            welcomeHero.classList.add('d-none');
        }

        // Append User Question Bubble
        appendUserBubble(query);

        // Reset input and disable send
        if (queryInput) {
            queryInput.value = '';
            queryInput.style.height = 'auto';
            queryInput.disabled = true;
        }
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.classList.remove('is-error');
        }
        if (sendBtnText) sendBtnText.textContent = 'Searching...';
        if (sendBtnIcon) sendBtnIcon.className = 'dm-spinner-sm';

        // Append Thinking / Loading Indicator
        const thinkingId = 'dm-thinking-' + Date.now();
        appendThinkingBubble(thinkingId);
        scrollChatToBottom();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
            const response = await fetch('/api/ask/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({
                    query: query,
                    language: currentLanguage,
                    force_visual: forceVisual,
                    api_key: localStorage.getItem('documind-api-key') || ''
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            removeElement(thinkingId);

            let data;
            try {
                data = await response.json();
            } catch (parseErr) {
                data = { success: false, error: 'Server returned an invalid response format.' };
            }

            if (data.success) {
                appendAiAnswerCard(data.answer, data.has_context_match, data.sources, data.language || currentLanguage, data.visual, query);

                // Update Sources Panel
                renderSourcesPanel(data.sources || [], query);

                if (vectorCountText && data.total_vectors !== undefined) {
                    vectorCountText.textContent = `${data.total_vectors} Vectors`;
                }
            } else {
                appendAiAnswerCard(data.error || 'The assistant could not complete your request.', false, data.sources || [], currentLanguage, null, query);
                renderSourcesPanel([], query);
                showToast(data.error || 'Query error', 'danger');
                if (sendBtn) {
                    sendBtn.classList.add('is-error');
                    setTimeout(() => sendBtn?.classList.remove('is-error'), 2000);
                }
            }
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                appendAiAnswerCard('The request timed out while generating a response. Please try asking again.', false, [], currentLanguage, null, query);
                showToast('Request timed out.', 'warning');
            } else {
                appendAiAnswerCard('Network communication error. Please ensure the Django server is running.', false, [], currentLanguage, null, query);
                showToast('Network error while querying assistant.', 'danger');
            }
            if (sendBtn) {
                sendBtn.classList.add('is-error');
                setTimeout(() => sendBtn?.classList.remove('is-error'), 2000);
            }
        } finally {
            if (thinkingId) {
                removeElement(thinkingId);
            }
            document.querySelectorAll('.dm-thinking-card').forEach(el => {
                const row = el.closest('.dm-message-row');
                if (row) row.remove();
            });
            if (queryInput) {
                queryInput.disabled = false;
                queryInput.focus();
            }
            if (sendBtn) sendBtn.disabled = false;
            if (sendBtnText) sendBtnText.textContent = 'Send';
            if (sendBtnIcon) sendBtnIcon.className = 'bi bi-arrow-up-circle-fill';
            scrollChatToBottom();
        }
    }

    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = queryInput.value.trim();
            if (query) {
                submitQuery(query, false);
            }
        });
    }

    function appendUserBubble(text) {
        const row = document.createElement('div');
        row.className = 'dm-message-row user';
        row.innerHTML = `
            <div class="dm-user-bubble">
                ${escapeHtml(text)}
            </div>
            <div class="dm-message-avatar dm-avatar-user" title="You">
                <i class="bi bi-person-fill"></i>
            </div>
        `;
        chatStream.appendChild(row);
        scrollChatToBottom();
    }

    function appendThinkingBubble(id) {
        const row = document.createElement('div');
        row.className = 'dm-message-row';
        row.id = id;
        row.innerHTML = `
            <div class="dm-message-avatar dm-avatar-ai">
                <i class="bi bi-cpu-fill text-primary"></i>
            </div>
            <div class="dm-thinking-card">
                <div class="dm-typing-dots">
                    <span class="dm-typing-dot"></span>
                    <span class="dm-typing-dot"></span>
                    <span class="dm-typing-dot"></span>
                </div>
                <span>Searching ChromaDB vector index & synthesizing response...</span>
            </div>
        `;
        chatStream.appendChild(row);
    }

    function appendAiAnswerCard(text, hasMatch, sources, answerLang = 'en', visual = null, originalQuery = '') {
        const row = document.createElement('div');
        row.className = 'dm-message-row';

        const statusBadge = hasMatch ? `
            <span class="badge bg-success-subtle text-success border border-success-subtle small fw-semibold">
                <i class="bi bi-shield-check me-1"></i> Grounded in Evidence
            </span>
        ` : `
            <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle small fw-semibold">
                <i class="bi bi-shield-exclamation me-1"></i> Context Restricted
            </span>
        `;

        const langCfg = LANG_CONFIG[answerLang] || LANG_CONFIG.en;
        const langBadge = `
            <span class="badge bg-light text-secondary border small fw-normal ms-1">
                <i class="bi bi-translate text-primary me-1"></i>${langCfg.label}
            </span>
        `;

        const formattedHtml = formatMarkdown(text);
        const visualId = 'dm-vis-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

        let visualHtml = '';
        const hasVisual = visual && typeof visual === 'object';
        const hasVisualData = hasVisual && visual.has_data !== false;

        if (hasVisual && !hasVisualData) {
            visualHtml = `
                <div class="alert alert-info small py-2 px-3 my-2">
                    <i class="bi bi-info-circle me-1"></i>
                    <span>${escapeHtml(visual.insufficient_data_reason || 'Insufficient numerical data for chart generation.')}</span>
                </div>
            `;
        } else if (hasVisual && hasVisualData) {
            const isMermaid = visual.type === 'mermaid';
            visualHtml = `
                <div class="border rounded-3 p-3 my-2 bg-light" id="${visualId}">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="badge bg-primary-subtle text-primary fw-semibold">${escapeHtml(visual.title || 'Visual Inspection')}</span>
                        ${isMermaid ? `
                        <button type="button" class="btn btn-sm btn-outline-secondary dm-visual-zoom-btn" data-zoom-target="${visualId}" title="Expand diagram">
                            <i class="bi bi-arrows-fullscreen"></i>
                        </button>
                        ` : ''}
                    </div>
                    <div id="pane-visual-${visualId}">
                        ${isMermaid ? `
                            <div class="dm-diagram-svg-wrap text-center" id="svg-wrap-${visualId}">
                                <div class="dm-spinner-sm"></div>
                            </div>
                        ` : `
                            <div style="height: 240px; position: relative;">
                                <canvas id="canvas-${visualId}"></canvas>
                            </div>
                        `}
                    </div>
                </div>
            `;
        }

        // Citation link summary
        let citationSummaryHtml = '';
        if (sources && sources.length > 0) {
            citationSummaryHtml = `
                <div class="dm-answer-citation-summary">
                    <span><i class="bi bi-quote text-primary"></i> Verified with ${sources.length} supporting passage${sources.length === 1 ? '' : 's'}</span>
                    <button type="button" class="btn btn-link btn-sm p-0 dm-view-sources-btn">View in Sources panel &rarr;</button>
                </div>
            `;
        }

        row.innerHTML = `
            <div class="dm-message-avatar dm-avatar-ai">
                <i class="bi bi-file-earmark-text-fill text-primary"></i>
            </div>
            <div class="dm-ai-card ${!hasMatch ? 'context-restricted' : ''}">
                <div class="dm-answer-header">
                    <div class="d-flex align-items-center flex-wrap gap-1">
                        ${statusBadge}
                        ${langBadge}
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <button type="button" class="btn btn-sm dm-tts-btn" title="Listen aloud">
                            <i class="bi bi-volume-up dm-tts-icon"></i>
                            <span class="dm-tts-label d-none d-sm-inline ms-1">Listen</span>
                        </button>
                        <button type="button" class="btn btn-link btn-sm text-secondary p-0 copy-answer-btn" title="Copy answer">
                            <i class="bi bi-clipboard"></i>
                        </button>
                    </div>
                </div>

                ${visualHtml}
                <div class="dm-answer-body">${formattedHtml}</div>
                ${citationSummaryHtml}
            </div>
        `;

        chatStream.appendChild(row);

        // Visual post-rendering
        if (hasVisual && hasVisualData) {
            if (visual.type === 'mermaid' && visual.code) {
                const svgWrap = document.getElementById('svg-wrap-' + visualId);
                if (svgWrap) {
                    renderMermaidDiagram(svgWrap, visual.code, visualId);
                }

                const zoomBtn = row.querySelector(`[data-zoom-target="${visualId}"]`);
                if (zoomBtn) {
                    zoomBtn.onclick = () => {
                        const targetWrap = document.getElementById('svg-wrap-' + visualId);
                        if (targetWrap) {
                            openDiagramZoomModal(targetWrap.innerHTML, visual.title || 'Visual Diagram Inspection');
                        }
                    };
                }
            } else if (visual.type === 'chartjs' && visual.chart_config) {
                const canvasEl = document.getElementById('canvas-' + visualId);
                if (canvasEl) {
                    renderChartJs(canvasEl, visual.chart_config);
                }
            }
        }

        // Bind View in Sources panel button
        const viewSourcesBtn = row.querySelector('.dm-view-sources-btn');
        if (viewSourcesBtn) {
            viewSourcesBtn.onclick = () => {
                if (window.innerWidth < 992 && tabBtnSources) {
                    tabBtnSources.click();
                } else if (colSources) {
                    colSources.scrollIntoView({ behavior: 'smooth' });
                    colSources.querySelectorAll('.dm-source-panel-card').forEach(card => {
                        card.style.borderColor = 'var(--dm-primary-blue)';
                        setTimeout(() => card.style.borderColor = '', 1500);
                    });
                }
            };
        }

        // TTS Listener
        const ttsBtn = row.querySelector('.dm-tts-btn');
        if (ttsBtn) {
            ttsBtn.onclick = () => {
                speakText(text, answerLang, ttsBtn);
            };
        }

        // Copy answer button
        const copyBtn = row.querySelector('.copy-answer-btn');
        if (copyBtn) {
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(text);
                copyBtn.innerHTML = '<i class="bi bi-check2 text-success"></i>';
                setTimeout(() => copyBtn.innerHTML = '<i class="bi bi-clipboard"></i>', 2000);
            };
        }

        scrollChatToBottom();
    }

    function removeElement(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // =========================================================================
    // API Key Configuration Modal
    // =========================================================================
    const saveKeyForm = document.getElementById('saveKeyForm');
    const modalApiKeyInput = document.getElementById('modalApiKeyInput');
    const modalKeyAlert = document.getElementById('modalKeyAlert');
    const saveKeyBtn = document.getElementById('saveKeyBtn');

    if (saveKeyForm) {
        if (modalApiKeyInput) {
            modalApiKeyInput.value = localStorage.getItem('documind-api-key') || '';
        }

        saveKeyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const key = modalApiKeyInput.value.trim();
            if (!key) return;

            localStorage.setItem('documind-api-key', key);

            saveKeyBtn.disabled = true;
            saveKeyBtn.innerHTML = '<span class="dm-spinner-sm me-1"></span> Saving...';
            modalKeyAlert.classList.add('d-none');

            try {
                const res = await fetch('/api/config/key/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({ api_key: key })
                });
                const data = await res.json();
                if (data.success) {
                    modalKeyAlert.className = 'alert alert-success small py-2 px-3 mb-3';
                    modalKeyAlert.textContent = data.message;
                    modalKeyAlert.classList.remove('d-none');
                    showToast('Gemini API Key saved and activated!', 'success');
                    setTimeout(() => {
                        const modalEl = document.getElementById('apiKeyModal');
                        const modal = bootstrap.Modal.getInstance(modalEl);
                        if (modal) modal.hide();
                    }, 1200);
                } else {
                    modalKeyAlert.className = 'alert alert-danger small py-2 px-3 mb-3';
                    modalKeyAlert.textContent = data.error || 'Failed to save key.';
                    modalKeyAlert.classList.remove('d-none');
                }
            } catch (err) {
                modalKeyAlert.className = 'alert alert-success small py-2 px-3 mb-3';
                modalKeyAlert.textContent = 'API Key saved locally in browser and active for this session!';
                modalKeyAlert.classList.remove('d-none');
                showToast('API Key saved locally in browser!', 'success');
                setTimeout(() => {
                    const modalEl = document.getElementById('apiKeyModal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }, 1200);
            } finally {
                saveKeyBtn.disabled = false;
                saveKeyBtn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> Save & Activate API Key';
            }
        });
    }

    // Toast alert helper
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('dmToastContainer');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `alert alert-${type} alert-dismissible fade show shadow-sm small py-2 px-3 mb-2`;
        toast.style.borderRadius = '8px';
        toast.innerHTML = `
            <span>${escapeHtml(message)}</span>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 200);
        }, 3500);
    }
});
