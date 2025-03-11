document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const resumeForm = document.getElementById('resumeForm');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resultsSection = document.getElementById('resultsSection');
    const loader = document.getElementById('loader');
    const analysisResults = document.getElementById('analysisResults');
    const selectedFile = document.getElementById('selectedFile');
    const fileName = document.getElementById('fileName');
    const removeFile = document.getElementById('removeFile');
    const errorMessage = document.getElementById('errorMessage');
    const downloadBtn = document.getElementById('downloadBtn');
    const browseBtn = document.querySelector('.browse-btn');
  
    // State to hold the currently selected file
    let currentFile = null;
  
    /**
     * Displays an error message that auto-hides after 5 seconds.
     * @param {string} message - The error message to display.
     */
    function showError(message) {
      errorMessage.querySelector('span').textContent = message;
      errorMessage.classList.remove('hidden');
      setTimeout(() => {
        errorMessage.classList.add('hidden');
      }, 5000);
    }
  
    /**
     * Validates the selected file.
     * Only PDF files under 5MB are allowed.
     * @param {File} file - The file to validate.
     * @returns {boolean} - True if valid, otherwise false.
     */
    function validateFile(file) {
      if (!file) return false;
      if (file.type !== 'application/pdf') {
        showError('Please upload a PDF file.');
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        showError('File size exceeds 5MB limit.');
        return false;
      }
      return true;
    }
  
    /**
     * Updates the UI when a file is selected.
     * Hides the drop zone and displays the selected file details.
     * @param {File} file - The file selected by the user.
     */
    function updateFileDisplay(file) {
      if (file && validateFile(file)) {
        fileName.textContent = file.name;
        selectedFile.classList.remove('hidden');
        dropZone.classList.add('hidden');
        analyzeBtn.disabled = false;
        currentFile = file;
      } else {
        resetFileSelection();
      }
    }
  
    /**
     * Resets the file selection UI to its default state.
     */
    function resetFileSelection() {
      fileInput.value = '';
      selectedFile.classList.add('hidden');
      dropZone.classList.remove('hidden');
      analyzeBtn.disabled = true;
      currentFile = null;
    }
  
    /**
     * Formats raw analysis text by splitting on double newlines,
     * highlighting numbered headers and bullet points.
     *
     * @param {string} analysis - The raw analysis text.
     * @returns {string} - HTML string with formatted content.
     */
    function formatAnalysis(analysis) {
      try {
        const sections = analysis.split('\n\n');
        let formattedHtml = '';
        sections.forEach(section => {
          const trimmed = section.trim();
          if (trimmed) {
            if (/^\d+\./.test(trimmed)) {
              const lines = trimmed.split('\n').filter(line => line.trim());
              const header = lines.shift().trim();
              formattedHtml += `<div class="analysis-section"><h3>${header}</h3>`;
              if (lines.length) {
                formattedHtml += '<ul>';
                lines.forEach(item => {
                  const cleanItem = item.replace(/^[-*]\s*/, '').trim();
                  formattedHtml += `<li class="analysis-point">${cleanItem}</li>`;
                });
                formattedHtml += '</ul>';
              }
              formattedHtml += '</div>';
            } else {
              formattedHtml += `<p>${trimmed}</p>`;
            }
          }
        });
        return formattedHtml;
      } catch (error) {
        console.error('Error formatting analysis:', error);
        return `<p>${analysis}</p>`;
      }
    }
  
    /**
     * Renders parsed analysis sections received from the server.
     * This function expects an object where keys are section headers and values are their content.
     *
     * @param {object} sections - Parsed sections from the server.
     * @returns {string} - HTML string with formatted sections.
     */
    function renderParsedAnalysis(sections) {
      let formattedHtml = '';
      // Sort entries by numeric order extracted from the header (e.g., "1. Format and Layout")
      const sortedEntries = Object.entries(sections).sort((a, b) => {
        const aNumMatch = a[0].match(/^(\d+)/);
        const bNumMatch = b[0].match(/^(\d+)/);
        const aNum = aNumMatch ? parseInt(aNumMatch[1], 10) : 0;
        const bNum = bNumMatch ? parseInt(bNumMatch[1], 10) : 0;
        return aNum - bNum;
      });
  
      sortedEntries.forEach(([header, content]) => {
        formattedHtml += `<div class="analysis-section"><h3>${header}</h3>`;
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        if (lines.length > 1) {
          // Check for bullet points (lines starting with "-" or "*")
          const bulletLines = lines.filter(line => /^[-*]/.test(line));
          if (bulletLines.length > 0) {
            // If the first line is not a bullet, display it as an introductory paragraph.
            if (!/^[-*]/.test(lines[0])) {
              formattedHtml += `<p>${lines[0]}</p>`;
            }
            formattedHtml += '<ul>';
            bulletLines.forEach(item => {
              const cleanItem = item.replace(/^[-*]\s*/, '');
              formattedHtml += `<li class="analysis-point">${cleanItem}</li>`;
            });
            formattedHtml += '</ul>';
            // Append any remaining non-bullet lines.
            lines.filter(line => !/^[-*]/.test(line)).slice(1).forEach(line => {
              formattedHtml += `<p>${line}</p>`;
            });
          } else {
            // Otherwise, wrap each line in a paragraph.
            lines.forEach(line => {
              formattedHtml += `<p>${line}</p>`;
            });
          }
        } else {
          formattedHtml += `<p>${content}</p>`;
        }
        formattedHtml += '</div>';
      });
  
      return formattedHtml;
    }
  
    /**
     * Generates a plain text report from the analysis result and triggers a download.
     *
     * @param {string} analysis - The analysis content to include in the report.
     */
    function generateReport(analysis) {
      const reportContent = `
  AI Resume Analysis Report
  Generated on: ${new Date().toLocaleDateString()}
  
  ${analysis}
      `;
      const blob = new Blob([reportContent.trim()], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'resume-analysis-report.txt';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  
    // --- Event Listeners for File Handling ---
  
    // Drag & drop events
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
  
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });
  
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const { files } = e.dataTransfer;
      if (files && files.length > 0) {
        updateFileDisplay(files[0]);
      }
    });
  
    // Trigger file selection via the browse button
    browseBtn.addEventListener('click', () => {
      fileInput.click();
    });
  
    // Handle file input changes
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        updateFileDisplay(e.target.files[0]);
      }
    });
  
    // Remove selected file event
    removeFile.addEventListener('click', resetFileSelection);
  
    // Download report button event
    downloadBtn.addEventListener('click', () => {
      const analysisText = analysisResults.textContent;
      if (analysisText.trim()) {
        generateReport(analysisText);
      } else {
        showError('No analysis available for download.');
      }
    });
  
    // --- Form Submission for Resume Analysis ---
  
    resumeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      if (!currentFile) {
        showError('Please select a resume file.');
        return;
      }
  
      // Update UI for analysis: show loader, clear previous results, and disable buttons
      resultsSection.classList.remove('hidden');
      loader.classList.remove('hidden');
      analysisResults.innerHTML = '';
      analyzeBtn.disabled = true;
      downloadBtn.classList.add('hidden');
  
      // Create form data with the selected file
      const formData = new FormData();
      formData.append('resume', currentFile);
  
      try {
        const response = await fetch('/analyze', {
          method: 'POST',
          body: formData,
        });
  
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to analyze the resume.');
        }
  
        const data = await response.json();
        // Use parsed sections if available; otherwise, fall back to raw analysis formatting.
        if (data.sections && Object.keys(data.sections).length > 0) {
          analysisResults.innerHTML = renderParsedAnalysis(data.sections);
        } else if (data.rawAnalysis) {
          analysisResults.innerHTML = formatAnalysis(data.rawAnalysis);
        } else {
          analysisResults.innerHTML = '<p>No analysis received.</p>';
        }
        downloadBtn.classList.remove('hidden');
      } catch (error) {
        console.error('Error during resume analysis:', error);
        showError(error.message);
      } finally {
        loader.classList.add('hidden');
        analyzeBtn.disabled = false;
      }
    });
  });
  