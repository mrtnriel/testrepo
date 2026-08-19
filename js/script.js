/**
 * G-Milestone Core Workflow Implementation
 * Refactored to include chronological Wizard flow and automated milestones.
 */

const app = {
    // Database Simulation
    projects: [],
    transactions: [],
    currentProjectViewId: null,
    currentCheckoutMilestoneIdx: null,
    
    // Wizard State
    currentWizardStep: 1,
    totalWizardSteps: 5,

    // Status Enums
    STATUS: {
        DRAFT: { text: "Draft", class: "bg-draft" },
        PAYMENT_REQUESTED: { text: "Payment Requested", class: "bg-requested" },
        PARTIALLY_PAID: { text: "Partially Paid", class: "bg-progress" },
        IN_PROGRESS: { text: "In Progress", class: "bg-progress" },
        READY: { text: "Ready", class: "bg-ready" },
        FINAL_PAYMENT_REQUESTED: { text: "Final Request Sent", class: "bg-requested" },
        COMPLETED: { text: "Completed", class: "bg-completed" }
    },

    init() {
        this.setupSidebar();
        
        // Load initial dummy data for presentation
        this.seedData();
        
        this.updateDashboard();
        this.renderProjectsList();
        this.renderTransactions();
    },

    // --- Navigation ---
    setupSidebar() {
        const container = document.querySelector('.app-container');
        const backdrop = document.getElementById('mobileBackdrop');

        // Toggle Collapse on Desktop
        document.getElementById('collapseBtn')?.addEventListener('click', () => container.classList.toggle('sidebar-collapsed'));
        
        // Open Sidebar on Mobile
        document.getElementById('mobileMenuBtn')?.addEventListener('click', () => container.classList.add('mobile-menu-open'));

        // Close Sidebar when clicking backdrop on Mobile
        if(backdrop) {
            backdrop.addEventListener('click', () => container.classList.remove('mobile-menu-open'));
        }

        // Handle navigation item clicks
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = item.getAttribute('data-target');
                if (!targetId) return;

                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                this.switchView(targetId);

                // Close mobile menu after navigating
                if (window.innerWidth <= 768) {
                    container.classList.remove('mobile-menu-open');
                }
            });
        });
    },

    switchView(viewId) {
        document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
        const target = document.getElementById(viewId);
        if (target) target.classList.remove('hidden');
        
        if(viewId === 'view-wallet') this.updateDashboard();
        if(viewId === 'view-projects-list') this.renderProjectsList();
        if(viewId === 'view-transactions') this.renderTransactions();
    },

    formatMoney(amount) {
        return parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    // --- Core Logic: Dashboard ---
    updateDashboard() {
        let totalValue = 0, collected = 0, activeCount = 0;

        this.projects.forEach(p => {
            totalValue += p.total;
            let pPaid = p.milestones.filter(m => m.paid).reduce((sum, m) => sum + m.amount, 0);
            collected += pPaid;
            
            if (p.status !== 'COMPLETED' && p.status !== 'DRAFT') {
                activeCount++;
            }
        });

        document.getElementById('dash-collected').innerText = this.formatMoney(collected);
        document.getElementById('dash-total-value').innerText = this.formatMoney(totalValue);
        document.getElementById('dash-outstanding').innerText = this.formatMoney(totalValue - collected);
        document.getElementById('dash-active-count').innerText = activeCount;
    },

    // --- Core Logic: Wizard Flow & Create Project ---
    showCreateProject() {
        // Reset form data
        document.getElementById('create-project-form').reset();
        document.getElementById('milestones-container').innerHTML = '';
        
        // Reset Wizard to Step 1
        this.currentWizardStep = 1;
        this.updateWizardUI();

        this.switchView('view-project-create');
    },

    updateWizardUI() {
        // Hide all steps, un-highlight all indicators
        for (let i = 1; i <= this.totalWizardSteps; i++) {
            document.getElementById(`wizard-step-${i}`).classList.remove('active');
            const indicator = document.getElementById(`indicator-step-${i}`);
            indicator.classList.remove('active', 'completed');
            
            // Mark previous steps as completed
            if (i < this.currentWizardStep) {
                indicator.classList.add('completed');
            } else if (i === this.currentWizardStep) {
                indicator.classList.add('active');
                // Ensure the progress bar scrolls to show the active step on mobile
                indicator.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
        
        // Show current step
        document.getElementById(`wizard-step-${this.currentWizardStep}`).classList.add('active');

        // Trigger milestone generation safely when arriving at step 3
        if (this.currentWizardStep === 3) {
            this.generateMilestones();
        }

        // Trigger data population when arriving at the final Review step
        if (this.currentWizardStep === 5) {
            this.populateReviewStep();
        }
    },

    validateCurrentStep() {
        const stepEl = document.getElementById(`wizard-step-${this.currentWizardStep}`);
        const inputs = stepEl.querySelectorAll('input[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.checkValidity()) {
                input.reportValidity();
                isValid = false;
            }
        });
        return isValid;
    },

    nextWizardStep(stepCalledFrom) {
        // Ensure we are operating on the correct logic
        if (this.currentWizardStep !== stepCalledFrom) return;
        
        // Prevent progressing if HTML5 validation fails
        if (!this.validateCurrentStep()) return;

        if (this.currentWizardStep < this.totalWizardSteps) {
            this.currentWizardStep++;
            this.updateWizardUI();
        }
    },

    prevWizardStep(stepCalledFrom) {
        if (this.currentWizardStep !== stepCalledFrom) return;

        if (this.currentWizardStep > 1) {
            this.currentWizardStep--;
            this.updateWizardUI();
        }
    },

    // Auto-calculate equal milestones
    generateMilestones() {
        const total = parseFloat(document.getElementById('projTotal').value) || 0;
        let count = parseInt(document.getElementById('projMilestoneCount').value) || 1;
        if (count < 1) count = 1; // Safeguard

        const container = document.getElementById('milestones-container');
        container.innerHTML = '';
        
        const splitAmount = total / count;
        
        for (let i = 1; i <= count; i++) {
            let defaultName = `Milestone ${i}`;
            if (count === 1) defaultName = "Full Payment";
            else if (i === 1) defaultName = "Downpayment";
            else if (i === count) defaultName = "Final Payment";

            const row = document.createElement('div');
            row.className = 'milestone-row';
            row.innerHTML = `
                <input type="text" class="form-control m-name" placeholder="Milestone Name" value="${defaultName}" required>
                <input type="number" class="form-control m-amt" placeholder="Amount ₱" value="${splitAmount.toFixed(2)}" step="0.01" min="1" required readonly tabindex="-1">
            `;
            container.appendChild(row);
        }

        document.getElementById('milestone-allocated').innerText = `₱${this.formatMoney(total)}`;
    },

    populateReviewStep() {
        // Customer Info
        const custName = document.getElementById('custName').value;
        const custMobile = document.getElementById('custMobile').value;
        const custEmail = document.getElementById('custEmail').value || 'Not provided';
        
        document.getElementById('rev-cust').innerHTML = `
            <strong>Name:</strong> ${custName} <br>
            <strong>Mobile:</strong> ${custMobile} <br>
            <strong>Email:</strong> ${custEmail}
        `;

        // Order Info
        const projName = document.getElementById('projName').value;
        const projTotal = document.getElementById('projTotal').value;
        const projDate = document.getElementById('projDate').value;
        
        document.getElementById('rev-order').innerHTML = `
            <strong>Project:</strong> ${projName} <br>
            <strong>Total Amount:</strong> ₱${this.formatMoney(projTotal)} <br>
            <strong>Target Date:</strong> ${projDate ? new Date(projDate).toLocaleDateString() : ''}
        `;

        // Milestone Info
        const milestonesCount = document.getElementById('projMilestoneCount').value;
        document.getElementById('rev-milestones').innerHTML = `
            Project value split evenly across <strong>${milestonesCount} payment milestones.</strong>
        `;

        // Penalty Info
        const penaltyAmt = document.getElementById('projPenaltyAmt').value;
        const penaltyWhen = document.getElementById('projPenaltyWhen').value;
        const penaltyReason = document.getElementById('projPenaltyReason').value;

        if (penaltyAmt && parseFloat(penaltyAmt) > 0) {
            const formattedPenaltyWhen = penaltyWhen ? new Date(penaltyWhen).toLocaleDateString() : 'Not specified';
            document.getElementById('rev-penalty').innerHTML = `
                <strong>Amount:</strong> ₱${this.formatMoney(penaltyAmt)} <br>
                <strong>Trigger Date:</strong> ${formattedPenaltyWhen} <br>
                <strong>Reason:</strong> ${penaltyReason || 'Not specified'}
            `;
        } else {
            document.getElementById('rev-penalty').innerHTML = `<em>No penalty fee configured.</em>`;
        }
    },

    handleCreateProject(e) {
        e.preventDefault();
        
        // Final sanity check
        if (!this.validateCurrentStep()) return;

        const btn = document.getElementById('btn-save-project');
        
        // Prevent duplicate submissions if already animating
        if (btn.classList.contains('is-loading') || btn.classList.contains('is-success')) return;

        // Start loading animation
        btn.classList.add('is-loading');
        btn.disabled = true;

        // Simulate Network Request / Processing time (1.5 seconds)
        setTimeout(() => {
            const isSuccess = true; // Hardcoded to simulate a successful API response

            if (isSuccess) {
                // Transition to success state (green checkmark)
                btn.classList.remove('is-loading');
                btn.classList.add('is-success');

                // Leave success state visible briefly, then execute the finalization logic
                setTimeout(() => {
                    this.finalizeProjectCreation();
                    
                    // Reset button silently after view has changed so it's ready for the next time
                    setTimeout(() => {
                        btn.classList.remove('is-success');
                        btn.disabled = false;
                    }, 300);
                }, 1000); 

            } else {
                // Example of failure handling
                btn.classList.remove('is-loading');
                btn.disabled = false;
                alert('Project creation failed. Please try again.');
            }
        }, 1500); 
    },

    finalizeProjectCreation() {
        const mNames = document.querySelectorAll('.m-name');
        const mAmts = document.querySelectorAll('.m-amt');
        const milestones = [];
        
        for (let i = 0; i < mNames.length; i++) {
            milestones.push({
                name: mNames[i].value,
                amount: parseFloat(mAmts[i].value),
                requested: false,
                paid: false,
                paidDate: null
            });
        }

        const penaltyAmt = parseFloat(document.getElementById('projPenaltyAmt').value) || 0;
        const penaltyWhen = document.getElementById('projPenaltyWhen').value;
        const penaltyReason = document.getElementById('projPenaltyReason').value;

        const newProj = {
            id: 'PRJ-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
            customer: {
                name: document.getElementById('custName').value,
                mobile: document.getElementById('custMobile').value,
                email: document.getElementById('custEmail').value
            },
            name: document.getElementById('projName').value,
            total: parseFloat(document.getElementById('projTotal').value),
            expectedDate: document.getElementById('projDate').value,
            status: 'DRAFT',
            milestones: milestones,
            penalty: {
                amount: penaltyAmt,
                when: penaltyWhen,
                reason: penaltyReason
            },
            createdAt: new Date().toISOString()
        };

        this.projects.unshift(newProj);
        this.openProjectDetail(newProj.id);
    },

    // --- Core Logic: Project Listing & Detail ---
    renderProjectsList() {
        const grid = document.getElementById('projects-grid');
        grid.innerHTML = '';

        if(this.projects.length === 0) {
            grid.innerHTML = `<div class="empty-state">No projects found. Create one to get started.</div>`;
            return;
        }

        this.projects.forEach(p => {
            const paidAmt = p.milestones.filter(m => m.paid).reduce((s, m) => s + m.amount, 0);
            const pct = p.total > 0 ? Math.round((paidAmt / p.total) * 100) : 0;
            const statusObj = this.STATUS[p.status];

            grid.innerHTML += `
                <div class="card project-card" onclick="app.openProjectDetail('${p.id}')">
                    <div class="project-header">
                        <div style="min-width: 0;">
                            <div class="project-title">${p.name}</div>
                            <div class="project-cust">${p.customer.name}</div>
                        </div>
                        <span class="status-badge ${statusObj.class}">${statusObj.text}</span>
                    </div>
                    <div class="mt-16">
                        <div class="d-flex justify-between text-sm mb-16" style="font-weight: 600;">
                            <span>₱${this.formatMoney(paidAmt)} Paid</span>
                            <span>₱${this.formatMoney(p.total)}</span>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: ${pct}%"></div>
                        </div>
                    </div>
                </div>
            `;
        });
    },

    openProjectDetail(id) {
        this.currentProjectViewId = id;
        const p = this.projects.find(x => x.id === id);
        if (!p) return;

        // Header Info
        document.getElementById('det-name').innerText = p.name;
        document.getElementById('det-customer').innerText = p.customer.name;
        document.getElementById('det-mobile').innerText = p.customer.mobile;
        
        const statusObj = this.STATUS[p.status];
        const badge = document.getElementById('det-status-badge');
        badge.className = `status-badge ${statusObj.class}`;
        badge.innerText = statusObj.text;

        // Sidebar info
        document.getElementById('det-id').innerText = p.id;
        document.getElementById('det-date').innerText = new Date(p.expectedDate).toLocaleDateString();
        document.getElementById('det-status-text').innerText = statusObj.text;

        // Calculations
        const paidAmt = p.milestones.filter(m => m.paid).reduce((s, m) => s + m.amount, 0);
        const remAmt = p.total - paidAmt;
        const pct = p.total > 0 ? Math.round((paidAmt / p.total) * 100) : 0;

        document.getElementById('det-total').innerText = `₱${this.formatMoney(p.total)}`;
        document.getElementById('det-paid').innerText = `₱${this.formatMoney(paidAmt)}`;
        document.getElementById('det-remaining').innerText = `₱${this.formatMoney(remAmt)}`;
        document.getElementById('det-progress-fill').style.width = `${pct}%`;
        document.getElementById('det-progress-text').innerText = `${pct}% PAID`;

        // Render Milestones Timeline
        const tl = document.getElementById('det-milestones');
        tl.innerHTML = '';
        
        p.milestones.forEach((m, idx) => {
            let stateClass = '';
            let metaText = 'Pending Request';
            let actionsHtml = '';

            if (m.paid) {
                stateClass = 'paid';
                metaText = `Paid on ${new Date(m.paidDate).toLocaleDateString()}`;
            } else if (m.requested) {
                stateClass = 'active';
                metaText = 'Payment Requested';
                actionsHtml = `<button class="btn-primary btn-sm" onclick="app.openCheckout('${p.id}', ${idx})">Simulate GCash Pay</button>`;
            } else {
                actionsHtml = `<button class="btn-outline btn-sm" onclick="app.sendPaymentRequest('${p.id}', ${idx})">Send Request</button>`;
            }

            tl.innerHTML += `
                <div class="timeline-item ${stateClass}">
                    <div class="tl-content">
                        <div>
                            <div class="tl-title">${m.name}</div>
                            <div class="tl-meta">${metaText}</div>
                        </div>
                        <div class="d-flex" style="flex-direction: column; align-items: flex-end;">
                            <div class="tl-amount">₱${this.formatMoney(m.amount)}</div>
                            <div class="tl-actions">${actionsHtml}</div>
                        </div>
                    </div>
                </div>
            `;
        });

        // Mark Order Ready Logic
        const readyCard = document.getElementById('ready-action-card');
        if ((p.status === 'IN_PROGRESS' || p.status === 'PARTIALLY_PAID') && p.milestones.some(m => !m.paid)) {
            readyCard.style.display = 'block';
        } else {
            readyCard.style.display = 'none';
        }

        this.switchView('view-project-detail');
    },

    // --- State Machine Automation & Payment Handling ---

    openCheckout(projId, milestoneIdx) {
        this.currentProjectViewId = projId;
        this.currentCheckoutMilestoneIdx = milestoneIdx;
        
        const p = this.projects.find(x => x.id === projId);
        const m = p.milestones[milestoneIdx];
        
        const breakdown = document.getElementById('checkout-breakdown');
        breakdown.innerHTML = `
            <div class="receipt-row"><span>Project:</span> <strong>${p.name}</strong></div>
            <div class="receipt-row"><span>Customer:</span> <strong>${p.customer.name}</strong></div>
            <div class="receipt-row"><span>Milestone:</span> <strong>${m.name}</strong></div>
        `;
        
        document.getElementById('checkout-amount-input').value = m.amount;
        
        this.switchView('view-checkout');
    },

    processPayment() {
        const paymentAmount = parseFloat(document.getElementById('checkout-amount-input').value);
        
        if (!paymentAmount || paymentAmount <= 0) {
            alert("Please enter a valid payment amount.");
            return;
        }

        this.simulateCustomerPay(this.currentProjectViewId, this.currentCheckoutMilestoneIdx);
    },

    sendPaymentRequest(projId, milestoneIdx) {
        const p = this.projects.find(x => x.id === projId);
        if(!p) return;

        p.milestones[milestoneIdx].requested = true;
        if(p.status === 'DRAFT') p.status = 'PAYMENT_REQUESTED';

        alert(`Payment Request for ₱${this.formatMoney(p.milestones[milestoneIdx].amount)} successfully sent to ${p.customer.mobile}.`);
        this.openProjectDetail(projId);
    },

    simulateCustomerPay(projId, milestoneIdx) {
        const p = this.projects.find(x => x.id === projId);
        if(!p) return;
        
        const m = p.milestones[milestoneIdx];
        
        m.paid = true;
        m.paidDate = new Date().toISOString();

        const newTxnId = 'TXN-' + Math.random().toString(36).substring(2, 9).toUpperCase();
        this.transactions.unshift({
            id: newTxnId,
            projName: p.name,
            customerName: p.customer.name,
            milestoneName: m.name,
            amount: m.amount,
            date: m.paidDate
        });

        const allPaid = p.milestones.every(x => x.paid);
        const anyPaid = p.milestones.some(x => x.paid);

        if (allPaid) {
            p.status = 'COMPLETED';
            alert(`Payment Authorized! Project Fully Paid! Status updated to COMPLETED.`);
        } else if (p.status === 'PAYMENT_REQUESTED' || p.status === 'DRAFT') {
            p.status = 'IN_PROGRESS';
            alert(`Payment Authorized! Initial payment received! Project automatically moved to IN PROGRESS.`);
        } else if (p.status === 'IN_PROGRESS' && anyPaid) {
             p.status = 'PARTIALLY_PAID';
             alert(`Payment Authorized!`);
        } else if (p.status === 'FINAL_PAYMENT_REQUESTED') {
            alert(`Payment Authorized!`);
        }

        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        document.querySelector('[data-target="view-transactions"]').classList.add('active');
        
        this.switchView('view-transactions');
        this.openInvoiceModal(newTxnId);
    },

    markOrderReady() {
        const projId = this.currentProjectViewId;
        const p = this.projects.find(x => x.id === projId);
        if(!p) return;

        p.status = 'READY';

        const nextMilestoneIdx = p.milestones.findIndex(m => !m.paid && !m.requested);
        if (nextMilestoneIdx !== -1) {
            p.milestones[nextMilestoneIdx].requested = true;
            p.status = 'FINAL_PAYMENT_REQUESTED';
            alert(`Order marked READY. System automatically generated and sent final payment request to ${p.customer.mobile}.`);
        } else {
             alert(`Order marked READY.`);
        }

        this.openProjectDetail(projId);
    },

    // --- Ledger / History ---
    renderTransactions() {
        const listDiv = document.getElementById('ledger-list');
        listDiv.innerHTML = '';
        
        if (this.transactions.length === 0) {
            listDiv.innerHTML = '<p class="empty-state">No recorded payments yet.</p>';
            return;
        }

        this.transactions.forEach(t => {
            listDiv.innerHTML += `
                <div class="ledger-item" style="flex-wrap: wrap; gap: 16px;">
                    <div style="flex: 1; min-width: 200px;">
                        <span class="tx-items">${t.projName}</span>
                        <span class="tx-meta">${t.milestoneName} • Ref: ${t.id} <br> ${new Date(t.date).toLocaleString()}</span>
                    </div>
                    <div class="d-flex" style="flex-direction: column; align-items: flex-end; gap: 8px;">
                        <div class="tx-amount">₱${this.formatMoney(t.amount)}</div>
                        <button class="btn-outline btn-sm" onclick="app.openInvoiceModal('${t.id}')">View Invoice</button>
                    </div>
                </div>
            `;
        });
    },

    // --- Invoice Modal Functions ---
    openInvoiceModal(txnId) {
        const t = this.transactions.find(x => x.id === txnId);
        if (!t) return;

        const body = document.getElementById('invoiceBody');
        body.innerHTML = `
            <div class="invoice-brand">
                <div class="invoice-brand-name">G-Milestone E-Receipt</div>
                <div class="text-muted text-sm mt-8">Official Payment Confirmation</div>
            </div>
            <div class="invoice-row"><span>Transaction ID:</span> <strong>${t.id}</strong></div>
            <div class="invoice-row"><span>Date:</span> <strong>${new Date(t.date).toLocaleString()}</strong></div>
            <div class="invoice-divider"></div>
            <div class="invoice-row"><span>Customer:</span> <strong>${t.customerName || 'N/A'}</strong></div>
            <div class="invoice-row"><span>Project:</span> <strong>${t.projName}</strong></div>
            <div class="invoice-row"><span>Milestone:</span> <strong>${t.milestoneName}</strong></div>
            <div class="invoice-divider"></div>
            <div class="invoice-row align-center">
                <span style="font-size: 14px; font-weight: 600;">Total Paid:</span> 
                <strong class="invoice-total">₱${this.formatMoney(t.amount)}</strong>
            </div>
        `;

        document.getElementById('invoiceModal').classList.remove('hidden');
    },

    closeInvoiceModal() {
        document.getElementById('invoiceModal').classList.add('hidden');
    },

    seedData() {
        this.projects = [
            {
                id: 'PRJ-M1001',
                customer: { name: "Maria Clara", mobile: "09170001234", email: "maria@example.com" },
                name: "Custom Corporate Giveaways",
                total: 25000,
                expectedDate: "2026-09-15",
                status: "IN_PROGRESS",
                createdAt: new Date().toISOString(),
                milestones: [
                    { name: "50% Downpayment", amount: 12500, requested: true, paid: true, paidDate: new Date(Date.now() - 86400000).toISOString() },
                    { name: "50% Upon Delivery", amount: 12500, requested: false, paid: false, paidDate: null }
                ]
            },
            {
                id: 'PRJ-M1002',
                customer: { name: "Juan Dela Cruz", mobile: "09180005678", email: "" },
                name: "Wedding Event Catering",
                total: 50000,
                expectedDate: "2026-10-10",
                status: "PAYMENT_REQUESTED",
                createdAt: new Date().toISOString(),
                milestones: [
                    { name: "Reservation Fee", amount: 10000, requested: true, paid: false, paidDate: null },
                    { name: "Progress Payment", amount: 20000, requested: false, paid: false, paidDate: null },
                    { name: "Final Balance", amount: 20000, requested: false, paid: false, paidDate: null }
                ]
            }
        ];

        this.transactions = [
            {
                id: 'TXN-A1B2C3D',
                projName: "Custom Corporate Giveaways",
                customerName: "Maria Clara",
                milestoneName: "50% Downpayment",
                amount: 12500,
                date: new Date(Date.now() - 86400000).toISOString()
            }
        ];
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => app.init());