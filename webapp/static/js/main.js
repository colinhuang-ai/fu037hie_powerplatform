// Main UI logic & helper functions for AdminLTE 3

document.addEventListener('DOMContentLoaded', () => {
    // 1. Real-time Defect Rate Calculator for Production Forms
    setupProductionCalculators();
});

// Calculate Pass Qty & Defect Rate dynamically
function setupProductionCalculators() {
    const calcContainers = document.querySelectorAll('.prod-calc-container');
    calcContainers.forEach(container => {
        const actualInput = container.querySelector('.input-actual');
        const defectInput = container.querySelector('.input-defect');
        const passOutput = container.querySelector('.output-pass');
        const rateOutput = container.querySelector('.output-rate');

        function updateValues() {
            if (!actualInput || !defectInput) return;
            const actual = parseInt(actualInput.value) || 0;
            const defect = parseInt(defectInput.value) || 0;

            if (defect > actual) {
                defectInput.setCustomValidity('Số lượng lỗi không được lớn hơn sản lượng thực tế!');
            } else {
                defectInput.setCustomValidity('');
            }

            const pass = Math.max(0, actual - defect);
            if (passOutput) {
                passOutput.value = pass;
            }

            const rate = actual > 0 ? ((defect / actual) * 100).toFixed(2) : 0.00;
            if (rateOutput) {
                rateOutput.value = rate + '%';
                
                // Color badge styling
                rateOutput.classList.remove('rate-good', 'rate-warning', 'rate-danger');
                if (rate <= 3.0) {
                    rateOutput.classList.add('rate-good');
                } else if (rate <= 5.0) {
                    rateOutput.classList.add('rate-warning');
                } else {
                    rateOutput.classList.add('rate-danger');
                }
            }
        }

        if (actualInput && defectInput) {
            actualInput.addEventListener('input', updateValues);
            defectInput.addEventListener('input', updateValues);
        }
    });
}

// Modal open/close functions with Bootstrap 4 Modal support
function openModal(modalId) {
    if (window.jQuery && $(`#${modalId}`).length) {
        $(`#${modalId}`).modal('show');
    } else {
        const el = document.getElementById(modalId);
        if (el) el.classList.add('show');
    }
}

function closeModal(modalId) {
    if (window.jQuery && $(`#${modalId}`).length) {
        $(`#${modalId}`).modal('hide');
    } else {
        const el = document.getElementById(modalId);
        if (el) el.classList.remove('show');
    }
}

// Quick fill for Edit Production Modal
function editProduction(log) {
    const form = document.getElementById('editProdForm');
    if (!form) return;

    form.action = `/production/edit/${log.id}`;
    form.querySelector('#edit_prod_date').value = log.prod_date;
    form.querySelector('#edit_shift').value = log.shift;
    form.querySelector('#edit_machine_id').value = log.machine_id;
    form.querySelector('#edit_worker_id').value = log.worker_id;
    form.querySelector('#edit_product_id').value = log.product_id;
    form.querySelector('#edit_target_qty').value = log.target_qty;
    form.querySelector('#edit_actual_qty').value = log.actual_qty;
    form.querySelector('#edit_defect_qty').value = log.defect_qty;
    form.querySelector('#edit_pass_qty').value = log.pass_qty;
    form.querySelector('#edit_defect_rate').value = log.defect_rate + '%';
    form.querySelector('#edit_defect_reason').value = log.defect_reason || '';
    form.querySelector('#edit_qc_status').value = log.qc_status || 'approved';
    form.querySelector('#edit_notes').value = log.notes || '';

    openModal('editProdModal');
}

// Quick fill for Edit Worker Modal
function editWorker(worker) {
    const form = document.getElementById('editWorkerForm');
    if (!form) return;

    form.action = `/workers/edit/${worker.id}`;
    form.querySelector('#edit_worker_code').value = worker.worker_code;
    form.querySelector('#edit_full_name').value = worker.full_name;
    form.querySelector('#edit_shift').value = worker.shift;
    form.querySelector('#edit_skill_level').value = worker.skill_level;
    form.querySelector('#edit_phone').value = worker.phone || '';
    form.querySelector('#edit_active').value = worker.active ? '1' : '0';

    openModal('editWorkerModal');
}

// Quick fill for Edit Machine Modal
function editMachine(machine) {
    const form = document.getElementById('editMachineForm');
    if (!form) return;

    form.action = `/machines/edit/${machine.id}`;
    form.querySelector('#edit_machine_code').value = machine.machine_code;
    form.querySelector('#edit_name').value = machine.name;
    form.querySelector('#edit_machine_type').value = machine.machine_type;
    form.querySelector('#edit_capacity').value = machine.capacity || '';
    form.querySelector('#edit_location').value = machine.location || '';
    form.querySelector('#edit_status').value = machine.status;

    openModal('editMachineModal');
}

// Quick fill for Edit User Modal
function editUser(user) {
    const form = document.getElementById('editUserForm');
    if (!form) return;

    form.action = `/users/edit/${user.id}`;
    form.querySelector('#edit_username_display').value = user.username;
    form.querySelector('#edit_full_name').value = user.full_name;
    form.querySelector('#edit_email').value = user.email || '';
    form.querySelector('#edit_role').value = user.role;

    openModal('editUserModal');
}
