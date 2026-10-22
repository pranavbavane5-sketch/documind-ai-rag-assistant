/**
 * Antigravity Document Intelligence Assistant - Core Client Engine
 * Asynchronous file uploads, streaming chat responses, and live citation viewer.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropzone = document.getElementById('agDropzone');
    const fileInput = document.getElementById('agFileInput');
    const uploadStatus = document.getElementById('uploadStatus');
    const docListContainer = document.getElementById('docListContainer');
    const docCountBadge = document.getElementById('docCountBadge');
    const vectorCountBadge = document.getElementById('vectorCountBadge');
    
    const chatStream = document.getElementById('chatStream');
    const chatForm = document.getElementById('chatForm');
    const queryInput = document.getElementById('queryInput');
    const sendBtn = document.getElementById('sendBtn');
    const welcomeHero = document.getElementById('welcomeHero');
    
    const citationContainer = document.getElementById('citationContainer');
    const citationBadge = document.getElementById('citationBadge');

    // Helper: Get CSRF Token
    function getCsrfToken() {
        const cookie = document.cookie.split('; ').find(row => row.startsWith('csrftoken='));
        return cookie ? cookie.split('=')[1] : (document.querySelector('[name=csrfmiddlewaretoken]')?.value || '');
    }

    // Helper: Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.innerText = text;
        return div.innerHTML;
    }

    // Auto-scroll chat to bottom
    function scrollChatToBottom() {
        if (chatStream) {
            chatStream.scrollTop = chatStream.scrollHeight;
        }
    }

    // Auto-resize textarea
    if (queryInput) {
        queryInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });

        // Submit on Enter (without Shift)
        queryInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                chatForm.dispatchEvent(new Event('submit'));
            }
        });
    }

    // Quick suggestion prompt chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const promptText = chip.getAttribute('data-prompt');
            if (queryInput) {
                queryInput.value = promptText;
                queryInput.dispatchEvent(new Event('input'));
                chatForm.dispatchEvent(new Event('submit'));
            }
        });
    });

    // =========================================================================
    // 1. Drag & Drop Asynchronous File Upload
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
        // Validate client side
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'pdf' && ext !== 'txt') {
            showToast('Only .pdf and .txt files are supported.', 'danger');
            return;
        }

        const formData = new FormData();
        formData.append('document', file);

        uploadStatus.classList.remove('d-none');
        uploadStatus.innerHTML = `
            <div class="d-flex align-items-center gap-2 small text-info">
                <div class="spinner-border spinner-border-sm" role="status"></div>
                <span>Embedding & indexing <strong>${escapeHtml(file.name)}</strong>...</span>
            </div>
        `;

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
                uploadStatus.innerHTML = `
                    <div class="small text-success d-flex align-items-center gap-1">
                        <i class="bi bi-check-circle-fill"></i> ${escapeHtml(data.message)}
                    </div>
                `;
                setTimeout(() => uploadStatus.classList.add('d-none'), 3500);

                // Add card to document list
                appendDocumentCard(data.document);

                // Update vector counter badge
                if (vectorCountBadge && data.total_vectors !== undefined) {
                    vectorCountBadge.textContent = `${data.total_vectors} Vectors`;
                }

                showToast(`Document indexed: ${data.document.name}`, 'success');
            } else {
                uploadStatus.innerHTML = `
                    <div class="small text-danger d-flex align-items-center gap-1">
                        <i class="bi bi-exclamation-triangle-fill"></i> ${escapeHtml(data.error || 'Upload failed')}
                    </div>
                `;
                showToast(data.error || 'Upload error', 'danger');
            }
        } catch (err) {
            uploadStatus.innerHTML = `
                <div class="small text-danger">Network error during upload.</div>
            `;
            showToast('Network error while processing file.', 'danger');
        } finally {
            fileInput.value = '';
        }
    }

    function appendDocumentCard(doc) {
        // Clear empty state message if present
        const emptyMsg = document.getElementById('emptyDocsMessage');
        if (emptyMsg) {
            emptyMsg.remove();
        }

        const isPdf = doc.type === '.pdf' || doc.name.endsWith('.pdf');
        const iconClass = isPdf ? 'bi-file-earmark-pdf text-danger' : 'bi-file-earmark-text text-primary';
        const pageBadge = doc.pages > 0 ? `<span class="badge ag-badge-indigo ms-1">${doc.pages}p</span>` : '';

        const card = document.createElement('div');
        card.className = 'doc-card-item d-flex justify-content-between align-items-center';
        card.id = `doc-card-${doc.id}`;
        card.innerHTML = `
            <div class="text-truncate me-2">
                <div class="fw-semibold text-truncate small d-flex align-items-center gap-2">
                    <i class="bi ${iconClass} fs-5"></i>
                    <span title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</span>
                </div>
                <div class="text-muted mt-1" style="font-size: 0.75rem;">
                    <span class="badge ag-badge-cyan">${doc.chunks} chunks</span>
                    ${pageBadge}
                    <span class="ms-1">${doc.size || ''}</span>
                </div>
            </div>
            <button class="btn btn-outline-danger btn-sm border-0 btn-delete-doc" data-id="${doc.id}" title="Remove file & vectors">
                <i class="bi bi-trash"></i>
            </button>
        `;

        docListContainer.prepend(card);
        attachDeleteListener(card.querySelector('.btn-delete-doc'));

        // Update doc count badge
        const currentCount = document.querySelectorAll('.doc-card-item').length;
        if (docCountBadge) {
            docCountBadge.textContent = `${currentCount} file${currentCount === 1 ? '' : 's'}`;
        }
    }

    // Attach deletion handler
    function attachDeleteListener(button) {
        if (!button) return;
        button.addEventListener('click', async () => {
            const docId = button.getAttribute('data-id');
            if (!confirm('Remove this document and purge its embeddings from the vector index?')) {
                return;
            }

            try {
                const response = await fetch(`/api/delete/${docId}/`, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': getCsrfToken()
                    }
                });
                const data = await response.json();

                if (data.success) {
                    const card = document.getElementById(`doc-card-${docId}`);
                    if (card) {
                        card.style.opacity = '0';
                        card.style.transform = 'translateX(-10px)';
                        setTimeout(() => {
                            card.remove();
                            const remaining = document.querySelectorAll('.doc-card-item').length;
                            if (docCountBadge) {
                                docCountBadge.textContent = `${remaining} file${remaining === 1 ? '' : 's'}`;
                            }
                            if (remaining === 0) {
                                docListContainer.innerHTML = `
                                    <div class="text-center py-4 text-muted small" id="emptyDocsMessage">
                                        <i class="bi bi-inbox fs-2 text-secondary d-block mb-1"></i>
                                        No documents indexed yet.
                                    </div>
                                `;
                            }
                        }, 250);
                    }

                    if (vectorCountBadge && data.total_vectors !== undefined) {
                        vectorCountBadge.textContent = `${data.total_vectors} Vectors`;
                    }
                    showToast('Document and vector embeddings removed.', 'info');
                } else {
                    showToast(data.error || 'Failed to delete document', 'danger');
                }
            } catch (err) {
                showToast('Error communicating with server.', 'danger');
            }
        });
    }

    document.querySelectorAll('.btn-delete-doc').forEach(attachDeleteListener);

    // =========================================================================
    // 2. Asynchronous RAG Chat Query & Streaming Output
    // =========================================================================
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const query = queryInput.value.trim();
            if (!query) return;

            // Hide welcome hero on first message
            if (welcomeHero) {
                welcomeHero.classList.add('d-none');
            }

            // Append User Chat Bubble
            appendUserBubble(query);

            // Clear input & reset height
            queryInput.value = '';
            queryInput.style.height = 'auto';

            // Disable send button
            sendBtn.disabled = true;

            // Show AI Thinking Indicator
            const thinkingId = 'thinking-' + Date.now();
            appendThinkingBubble(thinkingId);
            scrollChatToBottom();

            try {
                const response = await fetch('/api/ask/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({ query: query })
                });

                const data = await response.json();
                removeElement(thinkingId);

                if (data.success) {
                    appendAiBubble(data.answer, data.has_context_match, data.sources);
                    renderCitations(data.sources);

                    if (vectorCountBadge && data.total_vectors !== undefined) {
                        vectorCountBadge.textContent = `${data.total_vectors} Vectors`;
                    }
                } else {
                    appendAiBubble(data.error || 'An error occurred while answering your question.', false, []);
                    showToast(data.error || 'Request error', 'danger');
                }
            } catch (err) {
                removeElement(thinkingId);
                appendAiBubble('Network failure or server unavailable. Please try again.', false, []);
                showToast('Network error while querying assistant.', 'danger');
            } finally {
                sendBtn.disabled = false;
                scrollChatToBottom();
            }
        });
    }

    function appendUserBubble(text) {
        const bubble = document.createElement('div');
        bubble.className = 'd-flex align-items-start gap-2 mb-3 justify-content-end';
        bubble.innerHTML = `
            <div class="chat-bubble-user">
                <div style="white-space: pre-wrap; line-height: 1.5;">${escapeHtml(text)}</div>
            </div>
            <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" 
                 style="width: 34px; height: 34px; background: rgba(99,102,241,0.25); border: 1px solid rgba(99,102,241,0.5);">
                <i class="bi bi-person text-white"></i>
            </div>
        `;
        chatStream.appendChild(bubble);
        scrollChatToBottom();
    }

    function appendThinkingBubble(id) {
        const thinking = document.createElement('div');
        thinking.className = 'd-flex align-items-start gap-2 mb-3';
        thinking.id = id;
        thinking.innerHTML = `
            <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 pulse-glow" 
                 style="width: 34px; height: 34px; background: rgba(0, 242, 254, 0.15); border: 1px solid var(--ag-cyan);">
                <i class="bi bi-stars" style="color: var(--ag-cyan);"></i>
            </div>
            <div class="chat-bubble-ai d-flex align-items-center gap-2">
                <div class="spinner-grow spinner-grow-sm text-info" role="status"></div>
                <span class="small text-muted">Searching semantic vectors & synthesizing response...</span>
            </div>
        `;
        chatStream.appendChild(thinking);
    }

    function appendAiBubble(text, hasMatch, sources) {
        const bubble = document.createElement('div');
        bubble.className = 'd-flex align-items-start gap-2 mb-4';

        const notFoundBadge = !hasMatch ? `
            <div class="mb-2">
                <span class="badge ag-badge-indigo small">
                    <i class="bi bi-shield-exclamation me-1"></i> Context Restricted
                </span>
            </div>
        ` : '';

        const citationsNotice = (sources && sources.length > 0) ? `
            <div class="mt-2 pt-2 border-top border-secondary border-opacity-25 d-flex justify-content-between align-items-center">
                <span class="small text-muted">
                    <i class="bi bi-quote me-1"></i> ${sources.length} source snippet${sources.length === 1 ? '' : 's'} retrieved
                </span>
                <button class="btn btn-link btn-sm p-0 text-info small text-decoration-none btn-view-citations">
                    View in Citations Pane <i class="bi bi-arrow-right-short"></i>
                </button>
            </div>
        ` : '';

        bubble.innerHTML = `
            <div class="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0" 
                 style="width: 34px; height: 34px; background: rgba(0, 242, 254, 0.15); border: 1px solid var(--ag-cyan);">
                <i class="bi bi-cpu" style="color: var(--ag-cyan);"></i>
            </div>
            <div class="chat-bubble-ai ${!hasMatch ? 'not-found' : ''} flex-grow-1">
                ${notFoundBadge}
                <div class="ai-text-content" style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(text)}</div>
                ${citationsNotice}
            </div>
        `;

        chatStream.appendChild(bubble);

        // Quick jump button to open/highlight citation drawer
        const jumpBtn = bubble.querySelector('.btn-view-citations');
        if (jumpBtn) {
            jumpBtn.addEventListener('click', () => {
                const drawer = document.getElementById('citationDrawerCol');
                if (drawer) {
                    drawer.scrollIntoView({ behavior: 'smooth' });
                    drawer.classList.add('border-cyan-glow');
                    setTimeout(() => drawer.classList.remove('border-cyan-glow'), 1200);
                }
            });
        }

        scrollChatToBottom();
    }

    // =========================================================================
    // 3. Dynamic Citations & Context Viewer Rendering
    // =========================================================================
    function renderCitations(sources) {
        if (!citationContainer) return;

        if (!sources || sources.length === 0) {
            citationContainer.innerHTML = `
                <div class="text-center py-5 text-muted small">
                    <i class="bi bi-journal-text fs-2 text-secondary d-block mb-1"></i>
                    No citations retrieved for this response.
                </div>
            `;
            if (citationBadge) citationBadge.textContent = '0 Sources';
            return;
        }

        if (citationBadge) {
            citationBadge.textContent = `${sources.length} Sources`;
        }

        let html = '';
        sources.forEach((s, idx) => {
            const pageBadge = s.page ? `<span class="badge ag-badge-indigo ms-1">Page ${s.page}</span>` : '';
            const matchScore = s.relevance_score || 85;

            html += `
                <div class="citation-card">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-semibold small text-truncate text-white" title="${escapeHtml(s.filename)}">
                            <i class="bi bi-file-earmark-text text-info me-1"></i> ${escapeHtml(s.filename)}
                        </span>
                        <div>
                            ${pageBadge}
                            <span class="badge ag-badge-cyan ms-1">${matchScore}% match</span>
                        </div>
                    </div>
                    <div class="citation-passage mt-2">${escapeHtml(s.text)}</div>
                    <div class="d-flex justify-content-between align-items-center mt-2 small text-muted" style="font-size: 0.72rem;">
                        <span>Chunk #${s.chunk_index || (idx + 1)}</span>
                        <button class="btn btn-link btn-sm p-0 text-secondary text-decoration-none copy-passage-btn" 
                                data-text="${encodeURIComponent(s.text)}">
                            <i class="bi bi-clipboard"></i> Copy text
                        </button>
                    </div>
                </div>
            `;
        });

        citationContainer.innerHTML = html;

        // Copy button handlers
        citationContainer.querySelectorAll('.copy-passage-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = decodeURIComponent(btn.getAttribute('data-text'));
                navigator.clipboard.writeText(text);
                btn.innerHTML = '<i class="bi bi-check2 text-success"></i> Copied!';
                setTimeout(() => {
                    btn.innerHTML = '<i class="bi bi-clipboard"></i> Copy text';
                }, 2000);
            });
        });
    }

    function removeElement(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // Helper: Toast alert notification
    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('agToastContainer');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `alert alert-${type} alert-dismissible fade show shadow-lg small py-2 px-3 mb-2`;
        toast.style.background = type === 'danger' ? 'rgba(239,68,68,0.9)' : 'rgba(30,41,59,0.95)';
        toast.style.color = '#fff';
        toast.style.border = '1px solid rgba(255,255,255,0.15)';
        toast.style.borderRadius = '8px';
        toast.innerHTML = `
            <span>${escapeHtml(message)}</span>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 200);
        }, 4000);
    }
});
