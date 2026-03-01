document.addEventListener('DOMContentLoaded', () => {
    const analysisForm = document.getElementById('analysisForm');
    const resumeUpload = document.getElementById('resumeUpload');
    const fileUploadWrapper = document.querySelector('.file-upload-wrapper');
    const fileNameDisplay = document.getElementById('fileName');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');

    const inputSection = document.getElementById('inputSection');
    const resultsSection = document.getElementById('resultsSection');
    const resetBtn = document.getElementById('resetBtn');

    let scoreChartInstance = null;

    const fileUploadBtn = document.getElementById('fileUploadBtn');
    const fileUploadIcon = document.getElementById('fileUploadIcon');

    function setFileState(hasFile, fileName = 'Select or drag & drop PDF') {
        fileNameDisplay.textContent = fileName;
        if (hasFile) {
            fileUploadBtn.className = "flex flex-col items-center justify-center gap-4 py-12 px-8 bg-blue-500/10 border-2 border-dashed border-blue-500/50 rounded-2xl text-center transition-all duration-300";
            fileUploadIcon.className = "fa-solid fa-cloud-arrow-up text-3xl text-blue-500 transition-transform duration-300 transform -translate-y-1";
            fileNameDisplay.className = "font-semibold text-blue-500 transition-colors";
        } else {
            fileUploadBtn.className = "flex flex-col items-center justify-center gap-4 py-12 px-8 bg-white/5 border-2 border-dashed border-white/20 rounded-2xl text-center transition-all duration-300 group-hover:bg-blue-500/10 group-hover:border-blue-500/50";
            fileUploadIcon.className = "fa-solid fa-cloud-arrow-up text-3xl text-blue-400 transition-transform duration-300 group-hover:-translate-y-1";
            fileNameDisplay.className = "font-medium text-slate-400 group-hover:text-blue-400 transition-colors";
        }
    }

    // File input change handler
    resumeUpload.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            setFileState(true, e.target.files[0].name);
        } else {
            setFileState(false);
        }
    });

    // Reset application state
    resetBtn.addEventListener('click', () => {
        analysisForm.reset();
        setFileState(false);

        resultsSection.classList.add('hidden');
        inputSection.classList.remove('hidden');

        if (scoreChartInstance) {
            scoreChartInstance.destroy();
            scoreChartInstance = null;
        }
    });

    // Form submission handler
    analysisForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const resumeFile = resumeUpload.files[0];
        const jdText = document.getElementById('jdText').value;

        if (!resumeFile || !jdText.trim()) {
            alert('Please provide both a resume PDF and a job description.');
            return;
        }

        // UI State: Loading
        analyzeBtn.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');

        const formData = new FormData();
        formData.append('resume', resumeFile);
        formData.append('job_description', jdText);

        try {
            const response = await fetch('http://127.0.0.1:5000/api/analyze', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server error occurred');
            }

            const data = await response.json();

            // Render results
            renderResults(data);

            // Switch UI Sections
            inputSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');

        } catch (error) {
            console.error('Analysis errors:', error);
            alert(`Analysis failed: ${error.message}`);
        } finally {
            // Restore UI State
            analyzeBtn.classList.remove('hidden');
            loadingIndicator.classList.add('hidden');
        }
    });

    // Render all results
    function renderResults(data) {
        const output = data.strategist_output;
        if (!output) return;

        // Headers
        document.getElementById('candidateHeader').textContent =
            `${output.candidate.name}  vs  ${output.target_role.title}`;

        // 1. Overall Score & Chart
        const overallScore = output.match_score.overall || 0;
        document.getElementById('overallScore').textContent = `${overallScore}%`;
        renderScoreChart(overallScore);

        // 2. Tier Breakdown Bars
        const bd = output.match_score.breakdown || {};
        updateTierBar('req', bd.required?.tier_pct || 0);
        updateTierBar('pref', bd.preferred?.tier_pct || 0);
        updateTierBar('nth', bd.nice_to_have?.tier_pct || 0);

        // 3. Render Skills Gap content
        renderSkillsGap(bd);

        // 4. Render Roadmap Markdown
        if (output.roadmap_markdown) {
            document.getElementById('roadmapMarkdown').innerHTML = marked.parse(output.roadmap_markdown);
        } else {
            document.getElementById('roadmapMarkdown').innerHTML = '<p>No roadmap generated.</p>';
        }

        // 5. Render Scout Results
        const scoutContainer = document.getElementById('scoutMarkdown');
        if (scoutContainer) {
            if (data.scout_results && !data.scout_results.error) {
                // If the markdown response from the Scout agent contains a markdown string, parse it
                scoutContainer.innerHTML = marked.parse(data.scout_results);
            } else {
                scoutContainer.innerHTML = `<p>No job matches found or scout agent failed: ${data.scout_results?.error || 'Unknown error'}</p>`;
            }
        }

        // PDF Download button state
        const downloadBtn = document.getElementById('downloadPdfBtn');
        if (!data.report_ready) {
            downloadBtn.style.opacity = '0.5';
            downloadBtn.style.pointerEvents = 'none';
            downloadBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> PDF Unavailable';
            downloadBtn.href = '#';
        } else {
            downloadBtn.style.opacity = '1';
            downloadBtn.style.pointerEvents = 'auto';
            downloadBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Download PDF Report';
            downloadBtn.href = 'http://127.0.0.1:5000/api/download-report';
        }
    }

    // Chart.js implementation for the Donut Chart
    function renderScoreChart(score) {
        const ctx = document.getElementById('scoreChart').getContext('2d');

        if (scoreChartInstance) {
            scoreChartInstance.destroy();
        }

        scoreChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [score, Math.max(0, 100 - score)],
                    backgroundColor: [
                        '#3b82f6', // Primary Blue
                        'rgba(255, 255, 255, 0.1)' // Faded background
                    ],
                    borderWidth: 0,
                    borderRadius: 5,
                    cutout: '80%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                rotation: -90,
                circumference: 180, // Half circle
                plugins: {
                    tooltip: { enabled: false },
                    legend: { display: false }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 1500,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    // Update progress bars
    function updateTierBar(prefix, score) {
        document.getElementById(`${prefix}Score`).textContent = `${score}%`;
        const bar = document.getElementById(`${prefix}Bar`);

        // Small delay to allow CSS transition to work after unhiding container
        setTimeout(() => {
            bar.style.width = `${score}%`;
        }, 100);
    }

    // Render the skills gap section
    function renderSkillsGap(breakdown) {
        const container = document.getElementById('gapsContainer');
        container.innerHTML = ''; // Clear previous

        const tiers = [
            { key: 'required', label: 'Required Skills' },
            { key: 'preferred', label: 'Preferred Skills' },
            { key: 'nice_to_have', label: 'Nice-to-Have Skills' }
        ];

        tiers.forEach(tier => {
            const data = breakdown[tier.key];
            if (!data) return;

            const section = document.createElement('div');
            section.className = 'bg-white/5 border border-white/10 rounded-xl p-5';

            section.innerHTML = `<h4 class="flex justify-between items-center text-lg mb-4 text-white font-medium">${tier.label} <span class="text-sm text-slate-400">(${data.tier_pct || 0}% match)</span></h4>`;

            const list = document.createElement('div');
            list.className = 'flex flex-wrap gap-2.5';

            // Add matched skills
            if (data.matched && data.matched.length > 0) {
                data.matched.forEach(skill => {
                    list.innerHTML += `<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-sm text-emerald-400"><i class="fa-solid fa-check"></i> ${skill}</span>`;
                });
            }

            // Add missing skills
            if (data.missing && data.missing.length > 0) {
                data.missing.forEach(skill => {
                    list.innerHTML += `<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-full text-sm text-red-500"><i class="fa-solid fa-xmark"></i> ${skill}</span>`;
                });
            }

            if (list.innerHTML === '') {
                list.innerHTML = `<span class="text-slate-400 text-sm">No skills identified in this category.</span>`;
            }

            section.appendChild(list);
            container.appendChild(section);
        });
    }

    // Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active style from all
            tabBtns.forEach(b => {
                b.className = 'tab-btn px-6 py-3 bg-white/5 border border-transparent rounded-t-lg text-slate-400 font-heading font-semibold text-lg hover:bg-white/10 transition-colors';
            });
            tabContents.forEach(c => {
                c.classList.add('hidden');
                c.classList.remove('block');
            });

            // Add active styling to clicked
            btn.className = 'tab-btn active px-6 py-3 bg-card border-t border-x border-white/5 rounded-t-lg text-blue-400 font-heading font-semibold text-lg transition-colors shadow-[0_4px_0_0_#0f172a_inset]';
            const targetId = btn.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.remove('hidden');
                targetContent.classList.add('block');
            }
        });
    });
});
