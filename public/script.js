document.addEventListener('DOMContentLoaded', () => {
    // Speech Recognition Setup - Moved to top to ensure proper initialization
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isRecording = false;

    // Check if user is not logged in and redirect to login page
    const token = localStorage.getItem('token');
    if (!token && window.location.pathname !== '/login.html') {
        window.location.href = '/login.html';
        return;
    }

    // DOM Elements
    const chatLog = document.getElementById('chat-log');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const clearChatBtn = document.getElementById('clear-chat');
    const saveChatBtn = document.getElementById('save-chat');
    const toggleThemeBtn = document.getElementById('toggle-theme');
    const profileButton = document.getElementById('profile-button');
    const profileMenu = document.getElementById('profile-menu');
    const logoutButton = document.getElementById('logout-button');
    const typingIndicator = document.getElementById('typing-indicator');
    const buttonText = sendButton?.querySelector('.button-text');
    const loadingSpinner = sendButton?.querySelector('.loading-spinner');
    const quickActionBtns = document.querySelectorAll('.quick-action-btn');
    const micButton = document.getElementById('mic-button');
    
    const converter = new showdown.Converter();
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

    // Initialize Speech Recognition
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true; // Keep recording until manually stopped
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const lastResultIndex = event.results.length - 1;
            const transcript = event.results[lastResultIndex][0].transcript;
            userInput.value = transcript;
        };

        recognition.onend = () => {
            // Only restart if recording wasn't manually stopped
            if (isRecording) {
                recognition.start();
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            let errorMessage = '';
            
            switch (event.error) {
                case 'no-speech':
                    errorMessage = 'No speech detected. Still listening...';
                    break;
                case 'audio-capture':
                    errorMessage = 'No microphone found. Please check your microphone settings.';
                    stopRecording();
                    break;
                case 'not-allowed':
                    errorMessage = 'Microphone access denied. Please allow microphone access.';
                    stopRecording();
                    break;
                case 'network':
                    errorMessage = 'Network error occurred. Please check your connection.';
                    stopRecording();
                    break;
                default:
                    errorMessage = 'An error occurred. Still listening...';
            }
            
            if (!isRecording) {
                addMessageToChatLog('System', errorMessage, 'bot-message error');
            }
        };

        // Mic button click handler
        micButton?.addEventListener('click', () => {
            if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
        });
    } else {
        if (micButton) {
            micButton.style.display = 'none';
        }
        console.log('Speech recognition not supported in this browser');
    }

    function startRecording() {
        if (!isRecording && recognition) {
            try {
                recognition.start();
                isRecording = true;
                if (micButton) {
                    micButton.classList.add('recording');
                }
                if (userInput) {
                    userInput.placeholder = 'Listening...';
                }
            } catch (error) {
                console.error('Error starting recording:', error);
            }
        }
    }

    function stopRecording() {
        if (isRecording && recognition) {
            try {
                recognition.stop();
                isRecording = false;
                if (micButton) {
                    micButton.classList.remove('recording');
                }
                if (userInput) {
                    userInput.placeholder = 'Type your message...';
                }
            } catch (error) {
                console.error('Error stopping recording:', error);
            }
        }
    }

    // Text-to-Speech Setup
    const speechSynthesis = window.speechSynthesis;
    let selectedVoice = null;

    function initVoice() {
        const voices = speechSynthesis.getVoices();
        selectedVoice = voices.find(voice => 
            voice.lang === 'en-US' && 
            (voice.name.includes('Enhanced') || 
             voice.name.includes('Premium') || 
             voice.name.includes('Neural') || 
             voice.name.includes('Natural'))
        ) || voices.find(voice => 
            voice.lang === 'en-GB' && 
            (voice.name.includes('Enhanced') || 
             voice.name.includes('Premium') || 
             voice.name.includes('Neural') || 
             voice.name.includes('Natural'))
        ) || voices.find(voice => 
            voice.lang.startsWith('en') && 
            !voice.name.includes('Microsoft')
        ) || voices.find(voice => 
            voice.lang.startsWith('en')
        ) || voices[0];
    }

    if (speechSynthesis.onvoiceschanged !== undefined) {
        let attempts = 0;
        const maxAttempts = 3;
        
        const tryInitVoice = () => {
            initVoice();
            if (!selectedVoice && attempts < maxAttempts) {
                attempts++;
                setTimeout(tryInitVoice, 500);
            }
        };
        
        speechSynthesis.onvoiceschanged = tryInitVoice;
    }
    initVoice();

    function processTextForSpeech(text) {
        return text
            .replace(/```[\s\S]*?```/g, 'code block omitted')
            .replace(/`.*?`/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/[#*_~]/g, '')
            .replace(/([.!?])\s+/g, '$1, ')
            .replace(/,\s+/g, ', ')
            .replace(/\((.*?)\)/g, ', $1, ')
            .replace(/e\.g\./g, 'for example')
            .replace(/i\.e\./g, 'that is')
            .replace(/etc\./g, 'etcetera')
            .replace(/(\d+)/g, (match) => {
                return match.match(/^\d{4,}$/) ? match.replace(/(\d)(?=(\d{3})+$)/g, '$1 ') : match;
            })
            .replace(/[-+*/]/g, ' $& ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function speakText(text) {
        speechSynthesis.cancel();

        const cleanText = processTextForSpeech(text);
        const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];

        sentences.forEach((sentence, index) => {
            const utterance = new SpeechSynthesisUtterance(sentence.trim());
            utterance.voice = selectedVoice;
            
            const wordCount = sentence.split(/\s+/).length;
            utterance.rate = wordCount > 20 ? 0.95 : 1.0;
            utterance.pitch = sentence.trim().endsWith('?') ? 1.1 : 1.0;
            utterance.volume = 1.0;

            if (index > 0) {
                const breathingPause = new SpeechSynthesisUtterance('.');
                breathingPause.volume = 0;
                breathingPause.rate = 0.1;
                setTimeout(() => speechSynthesis.speak(breathingPause), index * 250);
            }

            utterance.onstart = () => {
                if (index === 0) {
                    const messages = document.querySelectorAll('.bot-message');
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage) {
                        lastMessage.classList.add('speaking');
                    }
                }
            };

            utterance.onend = () => {
                if (index === sentences.length - 1) {
                    const messages = document.querySelectorAll('.bot-message');
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage) {
                        lastMessage.classList.remove('speaking');
                    }
                }
            };

            setTimeout(() => {
                speechSynthesis.speak(utterance);
            }, index * (300 + Math.min(sentence.length * 2, 500)));
        });
    }

    // Profile menu toggle
    profileButton?.addEventListener('click', () => {
        profileMenu?.classList.toggle('active');
    });

    // Close profile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (profileButton && profileMenu && !profileButton.contains(e.target) && !profileMenu.contains(e.target)) {
            profileMenu.classList.remove('active');
        }
    });

    // Logout handler
    logoutButton?.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });

    // Quick action buttons
    quickActionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.dataset.prompt;
            if (userInput) {
                userInput.value = prompt;
                chatForm?.dispatchEvent(new Event('submit'));
            }
        });
    });

    chatForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = userInput?.value.trim();
        if (!message) return;

        // Stop any ongoing speech when sending a new message
        speechSynthesis.cancel();

        addMessageToChatLog('You', message, 'user-message');
        if (userInput) {
            userInput.value = '';
            userInput.disabled = true;
        }

        if (buttonText) buttonText.style.display = 'none';
        if (loadingSpinner) loadingSpinner.style.display = 'block';
        if (sendButton) sendButton.disabled = true;
        if (typingIndicator) typingIndicator.style.display = 'flex';

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ message, sessionId }),
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login.html';
                return;
            }

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let botMessage = '';
            const messageElement = document.createElement('div');
            messageElement.className = 'message bot-message';
            messageElement.innerHTML = '<strong>Bot:</strong> ';
            chatLog?.appendChild(messageElement);

            const replyContainer = document.createElement('span');
            messageElement.appendChild(replyContainer);

            // Add message actions
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            actionsDiv.innerHTML = `
                <button class="reaction-btn" title="Helpful">👍</button>
                <button class="reaction-btn" title="Not helpful">👎</button>
                <button class="reaction-btn" title="Copy response">📋</button>
                <button class="speak-btn" title="Listen to response">🔊</button>
            `;
            messageElement.appendChild(actionsDiv);

            // Add reaction handlers
            actionsDiv.querySelectorAll('.reaction-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.title === 'Copy response') {
                        navigator.clipboard.writeText(botMessage).then(() => {
                            btn.textContent = '✓';
                            setTimeout(() => btn.textContent = '📋', 2000);
                        });
                    } else {
                        btn.classList.toggle('active');
                    }
                });
            });

            // Add speak button handler
            const speakBtn = actionsDiv.querySelector('.speak-btn');
            speakBtn?.addEventListener('click', () => {
                if (speechSynthesis.speaking) {
                    speechSynthesis.cancel();
                    speakBtn.textContent = '🔊';
                } else {
                    speakText(botMessage);
                    speakBtn.textContent = '🔇';
                }
            });

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const content = line.slice(6).trim();
                        
                        if (content === '[DONE]') {
                            // Auto-play the response
                            speakText(botMessage);
                            break;
                        }
                        
                        try {
                            const data = JSON.parse(content);
                            botMessage += data.text;
                            replyContainer.innerHTML = converter.makeHtml(botMessage);
                            
                            // Apply syntax highlighting to code blocks
                            messageElement.querySelectorAll('pre code').forEach((block) => {
                                hljs.highlightBlock(block);
                            });
                            
                            if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
                        } catch (parseError) {
                            console.warn('Failed to parse chunk:', content);
                            continue;
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error:', error);
            addMessageToChatLog('Bot', 'Sorry, an error occurred while processing your request. Please try again.', 'bot-message error');
        } finally {
            if (buttonText) buttonText.style.display = 'block';
            if (loadingSpinner) loadingSpinner.style.display = 'none';
            if (sendButton) sendButton.disabled = false;
            if (userInput) {
                userInput.disabled = false;
                userInput.focus();
            }
            if (typingIndicator) typingIndicator.style.display = 'none';
        }
    });

    function addMessageToChatLog(sender, message, className) {
        if (!chatLog) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${className}`;
        
        let formattedMessage = converter.makeHtml(message);
        formattedMessage = formattedMessage.replace(/<pre><code>/g, '<pre><code class="hljs">');
        
        messageElement.innerHTML = `<strong>${sender}:</strong> ${formattedMessage}`;
        
        if (className === 'bot-message') {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            actionsDiv.innerHTML = `
                <button class="reaction-btn" title="Helpful">👍</button>
                <button class="reaction-btn" title="Not helpful">👎</button>
                <button class="reaction-btn" title="Copy response">📋</button>
                <button class="speak-btn" title="Listen to response">🔊</button>
            `;
            messageElement.appendChild(actionsDiv);

            actionsDiv.querySelectorAll('.reaction-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (btn.title === 'Copy response') {
                        navigator.clipboard.writeText(message).then(() => {
                            btn.textContent = '✓';
                            setTimeout(() => btn.textContent = '📋', 2000);
                        });
                    } else {
                        btn.classList.toggle('active');
                    }
                });
            });

            const speakBtn = actionsDiv.querySelector('.speak-btn');
            speakBtn?.addEventListener('click', () => {
                if (speechSynthesis.speaking) {
                    speechSynthesis.cancel();
                    speakBtn.textContent = '🔊';
                } else {
                    speakText(message);
                    speakBtn.textContent = '🔇';
                }
            });
        }

        chatLog.appendChild(messageElement);
        chatLog.scrollTop = chatLog.scrollHeight;

        messageElement.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightBlock(block);
        });
    }

    clearChatBtn?.addEventListener('click', async () => {
        const confirmed = confirm('Are you sure you want to clear the chat history?');
        if (!confirmed) return;

        // Stop any ongoing speech
        speechSynthesis.cancel();

        if (chatLog) chatLog.innerHTML = '';
        try {
            const response = await fetch('/clear-chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ sessionId }),
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/login.html';
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to clear chat history on server');
            }
        } catch (error) {
            console.error('Error clearing chat history:', error);
            addMessageToChatLog('System', 'Failed to clear chat history on server. Please try again.', 'bot-message error');
        }
    });

    saveChatBtn?.addEventListener('click', () => {
        // Stop any ongoing speech
        speechSynthesis.cancel();

        if (!chatLog) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const chatContent = chatLog.innerHTML;
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Chat History - ${timestamp}</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
                    .message { margin-bottom: 1rem; padding: 1rem; border-radius: 0.5rem; }
                    .user-message { background-color: #e9ecef; margin-left: 2rem; }
                    .bot-message { background-color: #f8f9fa; margin-right: 2rem; }
                    pre { background-color: #f8f9fa; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
                    code { font-family: monospace; }
                    .message-actions { display: none; }
                </style>
            </head>
            <body>
                <h1>Chat History</h1>
                <p>Saved on: ${new Date().toLocaleString()}</p>
                <div class="chat-log">
                    ${chatContent}
                </div>
            </body>
            </html>
        `;
        
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `chat-history-${timestamp}.html`;
        a.click();
        URL.revokeObjectURL(a.href);
    });

    toggleThemeBtn?.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        localStorage.setItem('darkTheme', document.body.classList.contains('dark-theme'));
    });

    // Handle input field
    userInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (sendButton && !sendButton.disabled) {
                chatForm?.dispatchEvent(new Event('submit'));
            }
        }
    });

    // Focus input field on load
    userInput?.focus();

    // Handle page visibility change to stop speech when tab is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            speechSynthesis.cancel();
        }
    });

    // Initialize theme from localStorage
    if (localStorage.getItem('darkTheme') === 'true') {
        document.body.classList.add('dark-theme');
    }

    // Set user name from token
    try {
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = tokenData.name;
        }
    } catch (error) {
        console.error('Error parsing token:', error);
    }
});