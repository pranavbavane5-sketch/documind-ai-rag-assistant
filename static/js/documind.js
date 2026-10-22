/**
 * DocuMind AI — Modern AI SaaS Client Engine
 * Asynchronous document ingestion, streaming chat answers, and inline verifiable citations.
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

    // Mobile View Toggle Elements
    const tabBtnDocs = document.getElementById('tabBtnDocs');
    const tabBtnChat = document.getElementById('tabBtnChat');
    const colDocs = document.getElementById('colDocs');
    const colChat = document.getElementById('colChat');

    // Theme Switcher (Dark Mode / Light Mode)
    const themeToggleBtn = document.getElementById('dmThemeToggle');
    const themeIcon = document.getElementById('dmThemeIcon');
    const htmlEl = document.documentElement;

    function applyTheme(theme) {
        htmlEl.setAttribute('data-theme', theme);
        localStorage.setItem('documind-theme', theme);
        if (themeIcon) {
            themeIcon.className = theme === 'dark' ? 'bi bi-sun-fill text-warning' : 'bi bi-moon-stars-fill text-dark';
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
    // Smart Visual Learning Engine: Diagram Zoom & High-Resolution Viewer
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

    // Initialize Mermaid with dynamic theme support
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
                <div class="dm-diagram-error-fallback">
                    <div class="d-flex align-items-center gap-1 text-danger fw-semibold small mb-1">
                        <i class="bi bi-exclamation-triangle-fill"></i> Diagram Formatting Fallback
                    </div>
                    <div class="text-muted small">Could not render graphical layout. Showing structured diagram definition:</div>
                    <pre><code>${escapeHtml(mermaidCode)}</code></pre>
                </div>
            `;
        }
    }

    function renderChartJs(canvasEl, chartConfig) {
        if (!window.Chart || !canvasEl) return;
        try {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const textColor = isDark ? '#cbd5e1' : '#334155';
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
                        <i class="bi bi-exclamation-circle me-1"></i> Could not display interactive chart: ${escapeHtml(err.message)}
                    </div>
                `;
            }
        }
    }

    // =========================================================================
    // Multilingual System Configuration (English, Hindi, Marathi)
    // =========================================================================
    const LANG_CONFIG = {
        en: {
            code: 'en',
            label: 'English',
            locale: 'en-IN',
            fallbackLocales: ['en-US', 'en-GB', 'en'],
            quickPrompts: {
                summarize: 'Summarize this document and highlight its core concepts, methodology, and key takeaways.',
                key_findings: 'What are the key findings, definitions, and concepts explained in the text?',
                explain_simply: 'Explain the main concepts of this document simply with easy-to-understand examples.',
                gen_questions: 'Generate 5 insightful review and study questions based on this document with answers grounded in the text.'
            },
            suggestedChips: [
                { icon: 'bi-file-earmark-text-fill', class: 'chip-violet', text: 'Summarize this document', prompt: 'Summarize this document and highlight its core concepts, methodology, and key takeaways.' },
                { icon: 'bi-lightbulb-fill', class: 'chip-cyan', text: 'Key definitions & concepts', prompt: 'What are the key findings, definitions, and concepts explained in the text?' },
                { icon: 'bi-check-circle-fill', class: 'chip-emerald', text: 'Main conclusions & takeaways', prompt: 'What are the main conclusions and practical applications discussed?' }
            ],
            listeningText: 'Listening in English (en-IN)... Speak your question',
            noSpeechMsg: 'No speech was detected. Please click the mic and try again.',
            unsupportedSpeech: 'Speech recognition is not supported in this browser. Please type your query.',
            unsupportedVoice: 'No native English voice found in your browser/OS. Using default system voice.'
        },
        hi: {
            code: 'hi',
            label: 'हिन्दी (Hindi)',
            locale: 'hi-IN',
            fallbackLocales: ['hi'],
            quickPrompts: {
                summarize: 'इस दस्तावेज़ का एक व्यापक सारांश प्रस्तुत करें और इसके मुख्य निष्कर्ष, विधियां और महत्वपूर्ण बिंदु बताएं।',
                key_findings: 'इस दस्तावेज़ में समझाए गए मुख्य निष्कर्ष, परिभाषाएँ और मूल अवधारणाएँ क्या हैं?',
                explain_simply: 'इस दस्तावेज़ के मुख्य विषय को सरल उदाहरणों के साथ आसानी से समझाएं।',
                gen_questions: 'इस दस्तावेज़ पर आधारित 5 महत्वपूर्ण प्रश्न और उनके सत्यापित उत्तर तैयार करें।'
            },
            suggestedChips: [
                { icon: 'bi-file-earmark-text-fill', class: 'chip-violet', text: 'दस्तावेज़ का सारांश दें', prompt: 'इस दस्तावेज़ का एक व्यापक सारांश प्रस्तुत करें और इसके मुख्य निष्कर्ष, विधियां और महत्वपूर्ण बिंदु बताएं।' },
                { icon: 'bi-lightbulb-fill', class: 'chip-cyan', text: 'मुख्य निष्कर्ष और अवधारणाएं', prompt: 'इस दस्तावेज़ में समझाए गए मुख्य निष्कर्ष, परिभाषाएँ और मूल अवधारणाएँ क्या हैं?' },
                { icon: 'bi-check-circle-fill', class: 'chip-emerald', text: 'सरल शब्दों में समझाएं', prompt: 'इस दस्तावेज़ के मुख्य विषय को सरल उदाहरणों के साथ आसानी से समझाएं।' }
            ],
            listeningText: 'हिन्दी में सुन रहे हैं (hi-IN)... अपना प्रश्न बोलें',
            noSpeechMsg: 'कोई आवाज़ नहीं सुनाई दी। कृपया माइक पर दोबारा क्लिक करें।',
            unsupportedSpeech: 'आपके ब्राउज़र में हिन्दी वाक् पहचान समर्थित नहीं है। कृपया टाइप करें।',
            unsupportedVoice: 'ब्राउज़र में हिन्दी आवाज़ नहीं मिली। मानक सिस्टम आवाज़ का उपयोग किया जा रहा है।'
        },
        mr: {
            code: 'mr',
            label: 'मराठी (Marathi)',
            locale: 'mr-IN',
            fallbackLocales: ['mr', 'hi-IN'],
            quickPrompts: {
                summarize: 'या दस्तऐवजाचा सर्वसमावेशक सारांश द्या आणि त्यातील मुख्य संकल्पना, पद्धती व निष्कर्ष स्पष्ट करा.',
                key_findings: 'दस्तऐवजातील प्रमुख निष्कर्ष, व्याख्या आणि महत्त्वाच्या संकल्पना कोणत्या आहेत?',
                explain_simply: 'या दस्तऐवजाचा मुख्य विषय उदाहरणांसह सोप्या भाषेत समजावून सांगा.',
                gen_questions: 'या दस्तऐवजावर आधारित 5 महत्त्वाचे प्रश्न आणि त्यांची सत्यापित उत्तरे तयार करा.'
            },
            suggestedChips: [
                { icon: 'bi-file-earmark-text-fill', class: 'chip-violet', text: 'दस्तऐवजाचा सारांश द्या', prompt: 'या दस्तऐवजाचा सर्वसमावेशक सारांश द्या आणि त्यातील मुख्य संकल्पना, पद्धती व निष्कर्ष स्पष्ट करा.' },
                { icon: 'bi-lightbulb-fill', class: 'chip-cyan', text: 'महत्त्वाचे निष्कर्ष व संकल्पना', prompt: 'दस्तऐवजातील प्रमुख निष्कर्ष, व्याख्या आणि महत्त्वाच्या संकल्पना कोणत्या आहेत?' },
                { icon: 'bi-check-circle-fill', class: 'chip-emerald', text: 'सोप्या भाषेत स्पष्ट करा', prompt: 'या दस्तऐवजाचा मुख्य विषय उदाहरणांसह सोप्या भाषेत समजावून सांगा.' }
            ],
            listeningText: 'मराठीत ऐकत आहे (mr-IN)... आपला प्रश्न बोला',
            noSpeechMsg: 'कोणताही आवाज ऐकू आला नाही. कृपया माइकवर पुन्हा क्लिक करा.',
            unsupportedSpeech: 'ब्राउझरमध्ये मराठी भाषा ओळख समर्थित नाही. कृपया टाइप करा.',
            unsupportedVoice: 'ब्राउझरमध्ये मराठी आवाज उपलब्ध नाही. मानक सिस्टम आवाजाचा वापर करत आहे.'
        }
    };

    let currentLanguage = localStorage.getItem('documind-lang') || 'en';

    function setLanguage(langCode) {
        if (!LANG_CONFIG[langCode]) langCode = 'en';
        currentLanguage = langCode;
        localStorage.setItem('documind-lang', langCode);

        const cfg = LANG_CONFIG[langCode];

        // Update dropdown item active states
        document.querySelectorAll('.dm-lang-opt').forEach(opt => {
            if (opt.getAttribute('data-lang') === langCode) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });

        // Update header labels
        const langLabel = document.getElementById('dmSelectedLangLabel');
        if (langLabel) langLabel.textContent = cfg.label;

        const localeTag = document.getElementById('dmActiveLocaleTag');
        if (localeTag) localeTag.textContent = cfg.locale;

        // Update bottom status badge
        const activeBadge = document.getElementById('dmActiveLangBadge');
        if (activeBadge) activeBadge.textContent = `${cfg.label} (${cfg.locale})`;

        // Re-render suggested prompt chips for the new language
        updatePromptChips(langCode);
    }

    // Attach Language selector listeners
    document.querySelectorAll('.dm-lang-opt').forEach(opt => {
        opt.addEventListener('click', () => {
            const lang = opt.getAttribute('data-lang');
            setLanguage(lang);
            showToast(`Language set to ${LANG_CONFIG[lang].label} (${LANG_CONFIG[lang].locale})`, 'info');
        });
    });

    // =========================================================================
    // Feature 3: Text-to-Speech (TTS) Engine
    // =========================================================================
    let currentSpeakingBtn = null;

    // Pre-cache voices when available
    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
        };
    }

    function cleanTextForSpeech(text) {
        if (!text) return '';
        let clean = text;
        // Strip code blocks
        clean = clean.replace(/```[\s\S]*?```/g, ' ');
        // Strip inline code
        clean = clean.replace(/`([^`]+)`/g, '$1');
        // Strip citation references like [Doc: ...] or Chunk #1
        clean = clean.replace(/\[(?:Doc|Page|Chunk)[^\]]*\]/gi, ' ');
        // Strip markdown headers
        clean = clean.replace(/^#{1,6}\s+/gm, ' ');
        // Strip bold and italic
        clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
        clean = clean.replace(/\*([^*]+)\*/g, '$1');
        clean = clean.replace(/__([^_]+)__/g, '$1');
        clean = clean.replace(/_([^_]+)_/g, '$1');
        // Strip bullet symbols
        clean = clean.replace(/^[\s*-•\d+.]+/gm, ' ');
        // Strip URLs and HTML tags
        clean = clean.replace(/https?:\/\/\S+/g, ' ');
        clean = clean.replace(/<[^>]+>/g, ' ');
        // Collapse excess whitespace
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
            if (icon) icon.className = 'bi bi-volume-up-fill dm-tts-icon';
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

        // If clicking the currently active speaker, toggle stop
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

        let selectedVoice = null;
        // 1. Exact locale match (e.g., 'hi-IN', 'mr-IN', 'en-IN')
        selectedVoice = voices.find(v => v.lang && v.lang.toLowerCase() === cfg.locale.toLowerCase());
        
        // 2. Language prefix match (e.g. 'hi', 'mr', 'en')
        if (!selectedVoice) {
            selectedVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(cfg.code.toLowerCase()));
        }

        // 3. Fallback locales match
        if (!selectedVoice && cfg.fallbackLocales) {
            for (const fl of cfg.fallbackLocales) {
                selectedVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(fl.toLowerCase()));
                if (selectedVoice) break;
            }
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
            utterance.lang = selectedVoice.lang;
        } else {
            utterance.lang = cfg.locale;
            if (langCode !== 'en') {
                showToast(`${cfg.label} voice not installed in system voices. Attempting browser playback.`, 'info');
            }
        }

        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
            currentSpeakingBtn = buttonEl;
            currentSpeakingBtn.classList.add('is-speaking');
            const icon = currentSpeakingBtn.querySelector('.dm-tts-icon');
            if (icon) icon.className = 'bi bi-stop-circle-fill dm-tts-icon text-danger';
            const label = currentSpeakingBtn.querySelector('.dm-tts-label');
            if (label) label.textContent = 'Stop';
        };

        utterance.onend = () => {
            stopSpeaking();
        };

        utterance.onerror = (e) => {
            stopSpeaking();
            if (e.error !== 'interrupted' && e.error !== 'canceled') {
                showToast('Voice playback encountered an error: ' + e.error, 'warning');
            }
        };

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

    // Lightweight, Safe Markdown Formatter for AI Responses
    function formatMarkdown(rawText) {
        if (!rawText) return '';
        
        let safe = escapeHtml(rawText);

        // Code blocks: ```language ... ```
        safe = safe.replace(/```(?:[a-zA-Z0-9_\-]+)?\n([\s\S]*?)```/g, (match, code) => {
            return `<pre class="dm-code-block"><code>${code.trim()}</code></pre>`;
        });

        // Inline code: `code`
        safe = safe.replace(/`([^`]+)`/g, '<code class="dm-inline-code">$1</code>');

        // Headings: ### Title or ## Title
        safe = safe.replace(/^###\s+(.*$)/gm, '<h5 class="dm-answer-heading">$1</h5>');
        safe = safe.replace(/^##\s+(.*$)/gm, '<h5 class="dm-answer-heading">$1</h5>');

        // Bold: **text**
        safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic: *text* (when not list bullet)
        safe = safe.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');

        // Unordered lists: lines starting with * or -
        const lines = safe.split('\n');
        let inList = false;
        let formatted = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const bulletMatch = line.match(/^(\s*)([-*•]|\d+\.)\s+(.+)$/);

            if (bulletMatch) {
                if (!inList) {
                    formatted.push('<ul>');
                    inList = true;
                }
                formatted.push(`<li>${bulletMatch[3]}</li>`);
            } else {
                if (inList) {
                    formatted.push('</ul>');
                    inList = false;
                }
                if (line.trim().length > 0) {
                    // Check if already a header or pre block
                    if (line.startsWith('<h5') || line.startsWith('<pre') || line.endsWith('</pre>')) {
                        formatted.push(line);
                    } else {
                        formatted.push(`<p>${line}</p>`);
                    }
                }
            }
        }
        if (inList) {
            formatted.push('</ul>');
        }

        return formatted.join('\n');
    }

    // Auto-scroll chat to bottom
    function scrollChatToBottom() {
        if (chatStream) {
            chatStream.scrollTop = chatStream.scrollHeight;
        }
    }

    // Auto-expand textarea height
    if (queryInput) {
        queryInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 130) + 'px';
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
            showToast('Chat history cleared.', 'info');
        });
    }

    // Hero "Upload First Document" Click Handler
    if (heroUploadBtn && fileInput) {
        heroUploadBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }

    // Mobile View Tab Switcher
    function initMobileTabs() {
        if (!tabBtnDocs || !tabBtnChat) return;

        function setMobileTab(activeTab) {
            if (window.innerWidth >= 992) {
                colDocs.classList.remove('active-mobile-panel');
                colChat.classList.remove('active-mobile-panel');
                return;
            }

            if (activeTab === 'docs') {
                tabBtnDocs.classList.add('active');
                tabBtnChat.classList.remove('active');
                colDocs.classList.add('active-mobile-panel');
                colChat.classList.remove('active-mobile-panel');
            } else {
                tabBtnChat.classList.add('active');
                tabBtnDocs.classList.remove('active');
                colChat.classList.add('active-mobile-panel');
                colDocs.classList.remove('active-mobile-panel');
            }
        }

        tabBtnDocs.addEventListener('click', () => setMobileTab('docs'));
        tabBtnChat.addEventListener('click', () => setMobileTab('chat'));

        // Initialize mobile state
        if (window.innerWidth < 992) {
            setMobileTab('docs');
        }

        window.addEventListener('resize', () => {
            if (window.innerWidth >= 992) {
                colDocs.classList.remove('active-mobile-panel');
                colChat.classList.remove('active-mobile-panel');
            }
        });
    }
    initMobileTabs();

    // Suggested question prompt chips
    function bindPromptChips() {
        document.querySelectorAll('.dm-pill-chip').forEach(chip => {
            chip.onclick = () => {
                const promptText = chip.getAttribute('data-prompt');
                if (queryInput) {
                    queryInput.value = promptText;
                    queryInput.dispatchEvent(new Event('input'));
                    // On mobile, switch to chat tab if needed
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
            btn.className = `dm-pill-chip ${chip.class}`;
            btn.setAttribute('data-prompt', chip.prompt);
            btn.innerHTML = `<i class="bi ${chip.icon}"></i> ${escapeHtml(chip.text)}`;
            chipsContainer.appendChild(btn);
        });

        bindPromptChips();
    }

    // Initialize prompt chips for current language
    setLanguage(currentLanguage);

    // =========================================================================
    // Feature 5: Quick Actions Bar (Summarize, Key Findings, Explain, Questions)
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
    // Feature 1: Speech Recognition (Voice Input through Microphone)
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
        const retryBtn = document.getElementById('dmVoiceRetryBtn');

        if (!micBtn) return;

        if (!SpeechRecognition) {
            micBtn.title = "Voice recognition is not supported in this browser (Use Chrome or Edge for Web Speech API).";
            micBtn.classList.add('opacity-50');
            micBtn.onclick = () => {
                showToast("Speech recognition is not supported in your browser. Please type your query or use Google Chrome / Microsoft Edge.", "warning");
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
                micBtn.setAttribute('aria-pressed', 'true');
                if (voiceBanner) voiceBanner.classList.remove('d-none');
                if (voiceStatusText) {
                    voiceStatusText.textContent = cfg.listeningText;
                }
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

                // Place editable text in the chat input in real-time
                const combined = (accumulatedTranscript + (interim ? ' ' + interim : '')).trim();
                if (queryInput && combined) {
                    queryInput.value = combined;
                    queryInput.dispatchEvent(new Event('input'));
                }
            };

            rec.onerror = (event) => {
                console.warn('SpeechRecognition error:', event.error);
                const cfg = LANG_CONFIG[currentLanguage] || LANG_CONFIG.en;

                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    showToast('Microphone access was denied. Please allow microphone permission in your browser to use voice input.', 'danger');
                    cleanupListening(false);
                } else if (event.error === 'no-speech') {
                    showToast(cfg.noSpeechMsg, 'warning');
                } else if (event.error === 'network') {
                    showToast('Voice recognition network error. Please check your internet connection.', 'warning');
                    cleanupListening(true);
                } else if (event.error === 'language-not-supported') {
                    showToast(`Speech recognition for ${cfg.label} (${cfg.locale}) is not supported by your browser engine. Please type your question.`, 'warning');
                    cleanupListening(false);
                } else {
                    showToast('Voice recognition: ' + event.error, 'warning');
                }
            };

            rec.onend = () => {
                if (isListening) {
                    cleanupListening(true);
                }
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
                console.error('Failed to start speech recognition:', err);
                showToast('Could not initiate voice recognition: ' + err.message, 'danger');
                cleanupListening(false);
            }
        }

        function cleanupListening(keepText) {
            isListening = false;
            if (micBtn) {
                micBtn.classList.remove('is-listening');
                micBtn.setAttribute('aria-pressed', 'false');
            }
            if (voiceBanner) {
                voiceBanner.classList.add('d-none');
            }
            if (!keepText && queryInput) {
                queryInput.value = '';
                queryInput.dispatchEvent(new Event('input'));
            }
        }

        function stopListening(keepText = true) {
            if (recognition) {
                try {
                    recognition.stop();
                } catch (e) {}
            }
            cleanupListening(keepText);
            if (queryInput && keepText) {
                queryInput.focus();
            }
        }

        function cancelListening() {
            if (recognition) {
                try {
                    recognition.abort();
                } catch (e) {}
            }
            cleanupListening(false);
        }

        function retryListening() {
            if (recognition) {
                try {
                    recognition.abort();
                } catch (e) {}
            }
            cleanupListening(false);
            setTimeout(() => {
                startListening();
            }, 150);
        }

        micBtn.addEventListener('click', (e) => {
            e.preventDefault();
            startListening();
        });

        if (stopBtn) stopBtn.addEventListener('click', () => stopListening(true));
        if (cancelBtn) cancelBtn.addEventListener('click', () => cancelListening());
        if (retryBtn) retryBtn.addEventListener('click', () => retryListening());
    }
    initSpeechRecognition();

    // =========================================================================
    // 1. Asynchronous Drag-and-Drop & Document Upload
    // =========================================================================
    if (dropzone && fileInput) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('dragover');
            });
        });

        dropzone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileUpload(files[0]);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFileUpload(fileInput.files[0]);
            }
        });
    }

    async function handleFileUpload(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'pdf' && ext !== 'txt') {
            showToast('Unsupported format. Please upload a .pdf or .txt document.', 'danger');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            showToast('File size exceeds the 10 MB maximum limit.', 'danger');
            return;
        }

        const formData = new FormData();
        formData.append('document', file);

        // Visible Processing State
        uploadFeedback.classList.remove('d-none');
        uploadFeedback.innerHTML = `
            <div class="d-flex align-items-center gap-2 text-primary fw-medium">
                <div class="dm-spinner-sm"></div>
                <span>Indexing <strong>${escapeHtml(file.name)}</strong> into ChromaDB...</span>
            </div>
            <div class="dm-progress-bar-wrap">
                <div class="dm-progress-indeterminate"></div>
            </div>
            <div class="text-muted small mt-1" style="font-size: 0.72rem;">
                Extracting text chunks & generating dense vector embeddings
            </div>
        `;

        if (dropzoneIcon) {
            dropzoneIcon.innerHTML = `<span class="dm-spinner-sm"></span>`;
        }

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
                    <div class="text-success d-flex align-items-center gap-1 fw-semibold">
                        <i class="bi bi-check-circle-fill"></i> ${escapeHtml(data.message)}
                    </div>
                `;
                setTimeout(() => uploadFeedback.classList.add('d-none'), 3500);

                appendDocumentCard(data.document);
                updateDocumentState(data.total_vectors);

                showToast(`Indexed: ${data.document.name}`, 'success');
            } else {
                uploadFeedback.innerHTML = `
                    <div class="text-danger d-flex align-items-center gap-1">
                        <i class="bi bi-exclamation-triangle-fill"></i> ${escapeHtml(data.error || 'Upload failed')}
                    </div>
                `;
                showToast(data.error || 'Upload error', 'danger');
            }
        } catch (err) {
            uploadFeedback.innerHTML = `
                <div class="text-danger">Network error during document upload.</div>
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

        // Switch Empty State to Ready State if welcomeHero is still visible
        if (count > 0 && welcomeHero && welcomeHero.querySelector('#dmHeroEmptyDocs')) {
            const firstDocName = document.querySelector('.dm-doc-title')?.textContent || 'your document';
            welcomeHero.innerHTML = `
                <div id="dmHeroWithDocs">
                    <div class="dm-welcome-hero-icon">
                        <i class="bi bi-stars"></i>
                    </div>
                    <h1 class="dm-welcome-title">Ask Anything About Your Documents</h1>
                    <div class="dm-welcome-subtitle">
                        DocuMind AI searches dense semantic vector chunks from your uploaded documents to synthesize verified, citation-backed answers.
                    </div>
                    <div class="dm-chips-label text-muted small mb-2 fw-medium">Suggested queries to try:</div>
                    <div class="d-flex flex-wrap justify-content-center gap-2" id="dmPromptChipsContainer">
                        <button class="dm-pill-chip chip-violet" data-prompt="Summarize ${escapeHtml(firstDocName)} and highlight its core concepts, methodology, and key takeaways.">
                            <i class="bi bi-file-earmark-text-fill"></i> Summarize this document
                        </button>
                        <button class="dm-pill-chip chip-cyan" data-prompt="What are the key findings, definitions, and concepts explained in the text?">
                            <i class="bi bi-lightbulb-fill"></i> Key definitions & concepts
                        </button>
                        <button class="dm-pill-chip chip-emerald" data-prompt="What are the main conclusions and practical applications discussed?">
                            <i class="bi bi-check-circle-fill"></i> Main conclusions & takeaways
                        </button>
                    </div>
                </div>
            `;
            bindPromptChips();
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
                    <span class="fw-semibold text-truncate small text-dark dm-doc-title" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</span>
                </div>
                <div class="d-flex align-items-center gap-2 text-muted" style="font-size: 0.74rem;">
                    <span>${doc.chunks} chunks</span>
                    ${pageBadge}
                    <span>&bull; ${doc.size || ''}</span>
                </div>
            </div>
            <div class="d-flex align-items-center gap-1 flex-shrink-0">
                <button class="btn btn-doc-action btn-summarize-doc" data-name="${escapeHtml(doc.name)}" title="Ask DocuMind to summarize this document">
                    <i class="bi bi-file-text"></i>
                </button>
                <button class="btn btn-doc-action btn-delete btn-delete-doc" data-id="${doc.id}" title="Delete file and vector embeddings">
                    <i class="bi bi-trash"></i>
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
                                        <div class="text-center py-5 text-muted small" id="dmEmptyDocsMessage">
                                            <div class="dm-empty-circle mx-auto mb-2">
                                                <i class="bi bi-folder2 text-secondary fs-4"></i>
                                            </div>
                                            <div class="fw-semibold text-dark">No documents indexed yet</div>
                                            <div class="text-muted mt-1" style="font-size: 0.78rem;">Upload a PDF or TXT above to build your vector knowledge base.</div>
                                        </div>
                                    `;

                                    // Switch back to pre-upload empty state in chat
                                    if (welcomeHero) {
                                        welcomeHero.innerHTML = `
                                            <div id="dmHeroEmptyDocs">
                                                <div class="dm-welcome-icon dm-welcome-icon-empty">
                                                    <i class="bi bi-file-earmark-arrow-up"></i>
                                                </div>
                                                <h1 class="dm-welcome-title">Welcome to DocuMind AI</h1>
                                                <div class="dm-welcome-subtitle">
                                                    Your AI-powered document intelligence assistant. Upload your lecture notes, research papers, or syllabus PDF to start extracting answers with verified source citations.
                                                </div>
                                                <button type="button" class="btn btn-primary rounded-pill px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2" id="dmHeroUploadBtn">
                                                    <i class="bi bi-cloud-arrow-up-fill"></i> Upload Your First Document
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
                        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
                        showToast(data.error || 'Failed to delete document', 'danger');
                    }
                } catch (err) {
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
                    showToast('Server communication error.', 'danger');
                }
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
    // =========================================================================
    // 2. Chat Query & Grounded Synthesis (with Smart Visual Learning Engine)
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
        if (sendBtn) sendBtn.disabled = true;
        if (sendBtnText) sendBtnText.textContent = 'Searching...';
        if (sendBtnIcon) sendBtnIcon.className = 'dm-spinner-sm';

        // Append Thinking / Loading Indicator
        const thinkingId = 'dm-thinking-' + Date.now();
        appendThinkingBubble(thinkingId);
        scrollChatToBottom();

        // 60s timeout controller for generative AI synthesis
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
                    force_visual: forceVisual
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

                if (vectorCountText && data.total_vectors !== undefined) {
                    vectorCountText.textContent = `${data.total_vectors} Vectors`;
                }
            } else {
                appendAiAnswerCard(data.error || 'The assistant could not complete your request.', false, data.sources || [], currentLanguage, null, query);
                showToast(data.error || 'Query error', 'danger');
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
        } finally {
            if (thinkingId) {
                removeElement(thinkingId);
            }
            // Unconditionally clean up any orphaned thinking indicators
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
            if (sendBtnIcon) sendBtnIcon.className = 'bi bi-arrow-right-short fs-5';
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
                <i class="bi bi-stars text-primary"></i>
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
            <span class="badge bg-secondary-subtle text-body border border-secondary-subtle small fw-normal ms-1" title="Response Language: ${langCfg.label}">
                <i class="bi bi-translate text-cyan me-1"></i>${langCfg.label}
            </span>
        `;

        // Render Citations with Feature 4: Evidence Lens
        let citationsHtml = '';
        if (sources && sources.length > 0) {
            const accordionId = 'cit-acc-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            let itemsHtml = '';
            sources.forEach((s, idx) => {
                const pageText = s.page ? `Page ${s.page}` : '';
                const matchScore = s.relevance_score || 85;

                itemsHtml += `
                    <div class="dm-citation-item">
                        <div class="dm-citation-header">
                            <span class="dm-citation-title text-truncate" title="${escapeHtml(s.filename)}">
                                <i class="bi bi-file-earmark-text text-violet me-1"></i> ${escapeHtml(s.filename)}
                            </span>
                            <div class="d-flex align-items-center gap-1">
                                ${pageText ? `<span class="dm-pill-page">${pageText}</span>` : ''}
                                <span class="dm-pill-match">${matchScore}% Match</span>
                            </div>
                        </div>
                        <div class="dm-citation-passage">${escapeHtml(s.text)}</div>
                        <div class="d-flex justify-content-between align-items-center mt-2 small text-muted" style="font-size: 0.72rem;">
                            <span>Chunk #${s.chunk_index || (idx + 1)}</span>
                            <button type="button" class="btn btn-link btn-sm p-0 text-decoration-none copy-passage-btn text-muted" 
                                    data-text="${encodeURIComponent(s.text)}">
                                <i class="bi bi-clipboard"></i> Copy passage
                            </button>
                        </div>
                    </div>
                `;
            });

            citationsHtml = `
                <div class="dm-citations-accordion mt-3">
                    <button class="dm-citations-toggle" type="button" data-bs-toggle="collapse" data-bs-target="#${accordionId}" aria-expanded="true">
                        <i class="bi bi-quote text-primary"></i>
                        <span>View Supporting Evidence (${sources.length} passage${sources.length === 1 ? '' : 's'})</span>
                        <i class="bi bi-chevron-down ms-1" style="font-size: 0.75rem;"></i>
                    </button>
                    <div class="collapse show mt-2" id="${accordionId}">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        }

        const formattedHtml = formatMarkdown(text);
        const visualId = 'dm-vis-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

        // Smart Visual Component HTML
        let visualHtml = '';
        const hasVisual = visual && typeof visual === 'object';
        const hasVisualData = hasVisual && visual.has_data !== false;

        if (hasVisual && !hasVisualData) {
            // Document lacks reliable data for this chart
            visualHtml = `
                <div class="dm-insufficient-data-alert">
                    <i class="bi bi-info-circle-fill fs-5 flex-shrink-0 text-warning"></i>
                    <div>
                        <strong>Insufficient Document Data for Visual Representation:</strong>
                        <div class="mt-1">${escapeHtml(visual.insufficient_data_reason || 'The uploaded documents do not contain enough numerical or categorical data to generate an accurate chart without inventing numbers.')}</div>
                    </div>
                </div>
            `;
        } else if (hasVisual && hasVisualData) {
            const subType = visual.sub_type || (visual.type === 'chartjs' ? 'chart' : 'flowchart');
            let badgeClass = 'dm-visual-badge-flowchart';
            let badgeText = 'Diagram';
            let visualTabLabel = 'View Diagram';

            if (subType === 'flowchart') {
                badgeClass = 'dm-visual-badge-flowchart';
                badgeText = 'Flowchart';
                visualTabLabel = 'View Flowchart';
            } else if (subType === 'block_diagram') {
                badgeClass = 'dm-visual-badge-block';
                badgeText = 'Block Diagram';
                visualTabLabel = 'View Architecture';
            } else if (subType === 'timeline') {
                badgeClass = 'dm-visual-badge-timeline';
                badgeText = 'Timeline';
                visualTabLabel = 'View Timeline';
            } else if (['bar', 'line', 'pie', 'doughnut', 'chart'].includes(subType) || visual.type === 'chartjs') {
                badgeClass = 'dm-visual-badge-chart';
                badgeText = subType.toUpperCase() + ' CHART';
                visualTabLabel = 'View Chart';
            } else if (subType === 'comparison') {
                badgeClass = 'dm-visual-badge-block';
                badgeText = 'Comparison';
                visualTabLabel = 'View Comparison';
            } else if (subType === 'concept_map') {
                badgeClass = 'dm-visual-badge-flowchart';
                badgeText = 'Concept Map';
                visualTabLabel = 'View Concept Map';
            }

            const title = escapeHtml(visual.title || 'Smart Visual Explanation');
            const isMermaid = visual.type === 'mermaid';

            visualHtml = `
                <div class="dm-visual-container" id="${visualId}">
                    <div class="dm-visual-header">
                        <div class="dm-visual-title-wrap">
                            <span class="dm-visual-badge ${badgeClass}">${badgeText}</span>
                            <span>${title}</span>
                        </div>
                        <div class="dm-visual-actions">
                            <div class="dm-vtab-group" role="tablist">
                                <button type="button" class="dm-vtab-btn active" data-tab="visual" data-target="${visualId}">
                                    <i class="bi bi-image"></i> ${visualTabLabel}
                                </button>
                                <button type="button" class="dm-vtab-btn" data-tab="explanation" data-target="${visualId}">
                                    <i class="bi bi-file-text"></i> Show Explanation
                                </button>
                                ${sources && sources.length > 0 ? `
                                <button type="button" class="dm-vtab-btn" data-tab="evidence" data-target="${visualId}">
                                    <i class="bi bi-shield-check"></i> Supporting Evidence
                                </button>
                                ` : ''}
                            </div>
                            ${isMermaid ? `
                            <button type="button" class="dm-visual-zoom-btn ms-1" data-zoom-target="${visualId}" title="Expand & Zoom Diagram">
                                <i class="bi bi-arrows-fullscreen"></i>
                            </button>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Tab 1: Visual Viewport -->
                    <div class="dm-visual-viewport dm-pane-visual" id="pane-visual-${visualId}">
                        ${isMermaid ? `
                            <div class="dm-diagram-svg-wrap" id="svg-wrap-${visualId}">
                                <div class="dm-spinner-sm"></div>
                            </div>
                        ` : `
                            <div class="dm-chart-canvas-wrap">
                                <canvas id="canvas-${visualId}"></canvas>
                            </div>
                        `}
                    </div>

                    <!-- Tab 2: Detailed Text Explanation -->
                    <div class="dm-visual-explanation-body dm-pane-explanation d-none" id="pane-exp-${visualId}">
                        <div class="small text-muted mb-2 fw-semibold text-uppercase" style="letter-spacing: 0.04em;">
                            <i class="bi bi-info-circle me-1 text-primary"></i> Detailed Text Explanation
                        </div>
                        <div>${formattedHtml}</div>
                    </div>

                    <!-- Tab 3: Supporting Evidence -->
                    ${sources && sources.length > 0 ? `
                    <div class="p-3 border-top dm-pane-evidence d-none" id="pane-evi-${visualId}" style="background-color: var(--dm-bg-surface);">
                        <div class="small text-muted mb-2 fw-semibold text-uppercase" style="letter-spacing: 0.04em;">
                            <i class="bi bi-shield-check me-1 text-success"></i> Document Source Grounding
                        </div>
                        ${citationsHtml}
                    </div>
                    ` : ''}
                </div>
            `;
        }

        // Option to request a visual explanation for text-only answers
        let visualRequestButtonHtml = '';
        if (!hasVisual && hasMatch && originalQuery) {
            visualRequestButtonHtml = `
                <div class="mt-2">
                    <button type="button" class="dm-btn-visual-request" data-query="${encodeURIComponent(originalQuery)}">
                        <i class="bi bi-diagram-3-fill text-primary"></i>
                        <span>Generate a visual explanation</span>
                    </button>
                </div>
            `;
        }

        row.innerHTML = `
            <div class="dm-message-avatar dm-avatar-ai">
                <i class="bi bi-robot text-primary"></i>
            </div>
            <div class="dm-ai-card ${!hasMatch ? 'context-restricted' : ''}">
                <div class="dm-answer-header">
                    <div class="d-flex align-items-center flex-wrap gap-1">
                        ${statusBadge}
                        ${langBadge}
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <!-- Feature 3: Text-to-Speech Speaker Button -->
                        <button type="button" class="btn btn-sm dm-tts-btn" title="Listen to answer aloud (${langCfg.label})">
                            <i class="bi bi-volume-up-fill dm-tts-icon"></i>
                            <span class="dm-tts-label d-none d-sm-inline ms-1">Listen</span>
                        </button>
                        <button type="button" class="btn btn-link btn-sm text-secondary p-0 copy-answer-btn" title="Copy answer">
                            <i class="bi bi-clipboard"></i>
                        </button>
                    </div>
                </div>

                <!-- Visual Engine Section (Diagram / Chart) -->
                ${visualHtml}

                <!-- Answer Body (Shown directly if no visual container or as standard text) -->
                ${!hasVisual || !hasVisualData ? `<div class="dm-answer-body">${formattedHtml}</div>` : ''}

                <!-- Visual Request Trigger Button for Text Answers -->
                ${visualRequestButtonHtml}

                <!-- Standalone Citations Accordion (if no visual container with tab) -->
                ${!hasVisual || !hasVisualData ? citationsHtml : ''}
            </div>
        `;

        chatStream.appendChild(row);

        // =====================================================================
        // Post-render binding: Mermaid Diagram or Chart.js execution
        // =====================================================================
        if (hasVisual && hasVisualData) {
            if (visual.type === 'mermaid' && visual.code) {
                const svgWrap = document.getElementById('svg-wrap-' + visualId);
                if (svgWrap) {
                    renderMermaidDiagram(svgWrap, visual.code, visualId);
                }

                // Bind zoom button for diagram inspection modal
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

            // Bind Visual Toolbar Tabs (Visual, Explanation, Evidence)
            const tabBtns = row.querySelectorAll(`.dm-vtab-btn[data-target="${visualId}"]`);
            const paneVisual = document.getElementById('pane-visual-' + visualId);
            const paneExp = document.getElementById('pane-exp-' + visualId);
            const paneEvi = document.getElementById('pane-evi-' + visualId);

            tabBtns.forEach(btn => {
                btn.onclick = () => {
                    tabBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    const tabType = btn.getAttribute('data-tab');
                    if (paneVisual) paneVisual.classList.toggle('d-none', tabType !== 'visual');
                    if (paneExp) paneExp.classList.toggle('d-none', tabType !== 'explanation');
                    if (paneEvi) paneEvi.classList.toggle('d-none', tabType !== 'evidence');
                };
            });
        }

        // Bind "Generate a visual explanation" button on text-only answers
        const visualReqBtn = row.querySelector('.dm-btn-visual-request');
        if (visualReqBtn) {
            visualReqBtn.onclick = () => {
                const orig = decodeURIComponent(visualReqBtn.getAttribute('data-query'));
                visualReqBtn.disabled = true;
                visualReqBtn.innerHTML = '<span class="dm-spinner-sm me-1"></span> Generating visual...';
                submitQuery(orig, true);
            };
        }

        // Feature 3: TTS Speaker listener
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

        // Copy passage button
        row.querySelectorAll('.copy-passage-btn').forEach(btn => {
            btn.onclick = () => {
                const passage = decodeURIComponent(btn.getAttribute('data-text'));
                navigator.clipboard.writeText(passage);
                btn.innerHTML = '<i class="bi bi-check2 text-success"></i> Copied!';
                setTimeout(() => btn.innerHTML = '<i class="bi bi-clipboard"></i> Copy passage', 2000);
            };
        });

        scrollChatToBottom();
    }

    function removeElement(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // =========================================================================
    // 3. API Key In-App Configuration Modal
    // =========================================================================
    const saveKeyForm = document.getElementById('saveKeyForm');
    const modalApiKeyInput = document.getElementById('modalApiKeyInput');
    const modalKeyAlert = document.getElementById('modalKeyAlert');
    const saveKeyBtn = document.getElementById('saveKeyBtn');

    if (saveKeyForm) {
        saveKeyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const key = modalApiKeyInput.value.trim();
            if (!key) return;

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
                modalKeyAlert.className = 'alert alert-danger small py-2 px-3 mb-3';
                modalKeyAlert.textContent = 'Server error while saving key.';
                modalKeyAlert.classList.remove('d-none');
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
