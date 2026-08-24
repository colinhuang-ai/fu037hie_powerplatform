from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, Response
import csv
import io
from datetime import datetime, timedelta
from functools import wraps
from database import get_db, init_db, hash_password, verify_password

app = Flask(__name__)
app.secret_key = 'electric_motor_prod_secret_key_2026_super_secure'

# Đảm bảo database đã sẵn sàng khi khởi chạy
init_db()

# --- HELPER & DECORATORS ---

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Vui lòng đăng nhập để truy cập hệ thống.', 'warning')
            return redirect(url_for('login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

def roles_required(*roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                flash('Vui lòng đăng nhập trước.', 'warning')
                return redirect(url_for('login'))
            if session.get('role') not in roles:
                flash('Bạn không có quyền truy cập chức năng này.', 'danger')
                return redirect(url_for('dashboard'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@app.template_filter('to_dict')
def to_dict_filter(row):
    if row is None:
        return {}
    if isinstance(row, dict):
        return row
    return dict(row)

@app.context_processor
def inject_user():
    return {
        'current_user': {
            'id': session.get('user_id'),
            'username': session.get('username'),
            'full_name': session.get('full_name'),
            'role': session.get('role')
        },
        'now': datetime.now(),
        'dict': dict
    }

# --- AUTHENTICATION ROUTES ---

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
        
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        
        conn = get_db()
        user = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
        conn.close()
        
        if user and verify_password(password, user['password_hash']):
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['full_name'] = user['full_name']
            session['role'] = user['role']
            flash(f'Chào mừng {user["full_name"]} quay trở lại hệ thống!', 'success')
            next_page = request.args.get('next')
            return redirect(next_page if next_page else url_for('dashboard'))
        else:
            flash('Tên đăng nhập hoặc mật khẩu không chính xác.', 'danger')
            
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('Đã đăng xuất khỏi hệ thống thành công.', 'info')
    return redirect(url_for('login'))

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (session['user_id'],)).fetchone()
    
    if request.method == 'POST':
        full_name = request.form.get('full_name', '').strip()
        email = request.form.get('email', '').strip()
        new_password = request.form.get('new_password', '').strip()
        current_password = request.form.get('current_password', '').strip()
        
        if not verify_password(current_password, user['password_hash']):
            flash('Mật khẩu hiện tại không đúng.', 'danger')
        else:
            if new_password:
                pw_hash = hash_password(new_password)
                conn.execute("UPDATE users SET full_name = ?, email = ?, password_hash = ? WHERE id = ?",
                             (full_name, email, pw_hash, user['id']))
            else:
                conn.execute("UPDATE users SET full_name = ?, email = ? WHERE id = ?",
                             (full_name, email, user['id']))
            conn.commit()
            session['full_name'] = full_name
            flash('Cập nhật thông tin cá nhân thành công!', 'success')
            return redirect(url_for('profile'))
            
    conn.close()
    return render_template('profile.html', user=user)

# --- DASHBOARD & ANALYTICS ---

@app.route('/')
@app.route('/dashboard')
@login_required
def dashboard():
    conn = get_db()
    
    # KPI 1: Tổng sản lượng thực tế, Tổng phế phẩm, Tỷ lệ lỗi trung bình
    kpi = conn.execute("""
        SELECT 
            COALESCE(SUM(actual_qty), 0) AS total_actual,
            COALESCE(SUM(pass_qty), 0) AS total_pass,
            COALESCE(SUM(defect_qty), 0) AS total_defect,
            COALESCE(AVG(defect_rate), 0) AS avg_defect_rate,
            COUNT(id) AS total_shifts
        FROM production_logs
    """).fetchone()
    
    # KPI 2: Sản lượng & Lỗi hôm nay
    today_str = datetime.now().strftime('%Y-%m-%d')
    today_kpi = conn.execute("""
        SELECT 
            COALESCE(SUM(actual_qty), 0) AS today_actual,
            COALESCE(SUM(defect_qty), 0) AS today_defect
        FROM production_logs
        WHERE prod_date = ?
    """, (today_str,)).fetchone()
    
    # KPI 3: Thống kê số lượng máy đang chạy
    machines_stat = conn.execute("""
        SELECT 
            COUNT(*) AS total_machines,
            SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running_machines,
            SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) AS maintenance_machines
        FROM machines
    """).fetchone()
    
    # KPI 4: Thống kê công nhân
    workers_stat = conn.execute("SELECT COUNT(*) as total_workers FROM workers WHERE active = 1").fetchone()
    
    # Top 5 máy có tỷ lệ lỗi cần chú ý
    top_defective_machines = conn.execute("""
        SELECT 
            m.name, m.machine_code,
            SUM(p.actual_qty) as total_qty,
            SUM(p.defect_qty) as defect_qty,
            ROUND(CAST(SUM(p.defect_qty) AS REAL) * 100.0 / NULLIF(SUM(p.actual_qty), 0), 2) as defect_rate
        FROM production_logs p
        JOIN machines m ON p.machine_id = m.id
        GROUP BY m.id
        ORDER BY defect_rate DESC
        LIMIT 5
    """).fetchall()

    # 5 Nhật ký gần nhất
    recent_logs = conn.execute("""
        SELECT 
            p.*, 
            w.full_name as worker_name, w.worker_code,
            m.name as machine_name, m.machine_code,
            pr.name as product_name
        FROM production_logs p
        JOIN workers w ON p.worker_id = w.id
        JOIN machines m ON p.machine_id = m.id
        JOIN products pr ON p.product_id = pr.id
        ORDER BY p.prod_date DESC, p.id DESC
        LIMIT 6
    """).fetchall()
    
    conn.close()
    
    return render_template('dashboard.html', 
                           kpi=kpi, 
                           today_kpi=today_kpi,
                           machines_stat=machines_stat,
                           workers_stat=workers_stat,
                           top_defective_machines=top_defective_machines,
                           recent_logs=recent_logs)

@app.route('/api/chart-data')
@login_required
def api_chart_data():
    conn = get_db()
    
    # 1. Biểu đồ xu hướng sản lượng & tỷ lệ lỗi 10 ngày gần nhất
    daily_stats = conn.execute("""
        SELECT 
            prod_date,
            SUM(actual_qty) as total_actual,
            SUM(defect_qty) as total_defect,
            ROUND(CAST(SUM(defect_qty) AS REAL) * 100.0 / NULLIF(SUM(actual_qty), 0), 2) as defect_rate
        FROM production_logs
        GROUP BY prod_date
        ORDER BY prod_date ASC
        LIMIT 14
    """).fetchall()
    
    dates = [row['prod_date'] for row in daily_stats]
    actual_data = [row['total_actual'] for row in daily_stats]
    defect_data = [row['total_defect'] for row in daily_stats]
    rate_data = [row['defect_rate'] for row in daily_stats]
    
    # 2. Biểu đồ cơ cấu nguyên nhân lỗi (Pie/Doughnut)
    defect_reasons = conn.execute("""
        SELECT 
            defect_reason,
            SUM(defect_qty) as count
        FROM production_logs
        WHERE defect_qty > 0 AND defect_reason IS NOT NULL AND defect_reason != ''
        GROUP BY defect_reason
        ORDER BY count DESC
        LIMIT 6
    """).fetchall()
    
    reasons_labels = [row['defect_reason'] for row in defect_reasons]
    reasons_counts = [row['count'] for row in defect_reasons]
    
    # 3. Sản lượng theo dòng sản phẩm
    product_stats = conn.execute("""
        SELECT 
            pr.name,
            SUM(p.actual_qty) as total_qty
        FROM production_logs p
        JOIN products pr ON p.product_id = pr.id
        GROUP BY pr.id
        ORDER BY total_qty DESC
        LIMIT 5
    """).fetchall()
    
    product_labels = [row['name'] for row in product_stats]
    product_data = [row['total_qty'] for row in product_stats]

    conn.close()
    
    return jsonify({
        'daily': {
            'dates': dates,
            'actual': actual_data,
            'defect': defect_data,
            'rate': rate_data
        },
        'reasons': {
            'labels': reasons_labels,
            'counts': reasons_counts
        },
        'products': {
            'labels': product_labels,
            'data': product_data
        }
    })

# --- PRODUCTION MANAGEMENT (NHẬT KÝ SẢN XUẤT) ---

@app.route('/production')
@login_required
def production_list():
    conn = get_db()
    
    # Lấy tham số bộ lọc
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')
    worker_id = request.args.get('worker_id', '')
    machine_id = request.args.get('machine_id', '')
    qc_status = request.args.get('qc_status', '')
    
    query = """
        SELECT 
            p.*, 
            w.full_name as worker_name, w.worker_code,
            m.name as machine_name, m.machine_code,
            pr.name as product_name, pr.product_code
        FROM production_logs p
        JOIN workers w ON p.worker_id = w.id
        JOIN machines m ON p.machine_id = m.id
        JOIN products pr ON p.product_id = pr.id
        WHERE 1=1
    """
    params = []
    
    if date_from:
        query += " AND p.prod_date >= ?"
        params.append(date_from)
    if date_to:
        query += " AND p.prod_date <= ?"
        params.append(date_to)
    if worker_id:
        query += " AND p.worker_id = ?"
        params.append(worker_id)
    if machine_id:
        query += " AND p.machine_id = ?"
        params.append(machine_id)
    if qc_status:
        query += " AND p.qc_status = ?"
        params.append(qc_status)
        
    query += " ORDER BY p.prod_date DESC, p.id DESC"
    
    logs = conn.execute(query, params).fetchall()
    workers = conn.execute("SELECT id, worker_code, full_name FROM workers WHERE active = 1 ORDER BY full_name").fetchall()
    machines = conn.execute("SELECT id, machine_code, name FROM machines ORDER BY machine_code").fetchall()
    products = conn.execute("SELECT id, product_code, name FROM products ORDER BY name").fetchall()
    
    conn.close()
    
    return render_template('production.html', 
                           logs=logs, 
                           workers=workers, 
                           machines=machines, 
                           products=products,
                           filter_params={
                               'date_from': date_from,
                               'date_to': date_to,
                               'worker_id': worker_id,
                               'machine_id': machine_id,
                               'qc_status': qc_status
                           })

@app.route('/production/add', methods=['POST'])
@login_required
def production_add():
    prod_date = request.form.get('prod_date')
    shift = request.form.get('shift')
    machine_id = request.form.get('machine_id')
    worker_id = request.form.get('worker_id')
    product_id = request.form.get('product_id')
    target_qty = int(request.form.get('target_qty', 0))
    actual_qty = int(request.form.get('actual_qty', 0))
    defect_qty = int(request.form.get('defect_qty', 0))
    defect_reason = request.form.get('defect_reason', '').strip()
    notes = request.form.get('notes', '').strip()
    qc_status = request.form.get('qc_status', 'approved')
    
    if actual_qty <= 0:
        flash('Số lượng sản xuất thực tế phải lớn hơn 0.', 'danger')
        return redirect(url_for('production_list'))
        
    if defect_qty > actual_qty:
        flash('Số lượng lỗi không thể lớn hơn số lượng sản xuất thực tế.', 'danger')
        return redirect(url_for('production_list'))
        
    pass_qty = actual_qty - defect_qty
    defect_rate = round((defect_qty / actual_qty) * 100.0, 2)
    
    conn = get_db()
    conn.execute("""
        INSERT INTO production_logs 
        (prod_date, shift, machine_id, worker_id, product_id, target_qty, actual_qty, pass_qty, defect_qty, defect_rate, defect_reason, notes, qc_status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (prod_date, shift, machine_id, worker_id, product_id, target_qty, actual_qty, pass_qty, defect_qty, defect_rate, defect_reason, notes, qc_status, session['user_id']))
    conn.commit()
    conn.close()
    
    flash('Thêm bản ghi nhật ký sản xuất thành công!', 'success')
    return redirect(url_for('production_list'))

@app.route('/production/edit/<int:log_id>', methods=['POST'])
@login_required
def production_edit(log_id):
    prod_date = request.form.get('prod_date')
    shift = request.form.get('shift')
    machine_id = request.form.get('machine_id')
    worker_id = request.form.get('worker_id')
    product_id = request.form.get('product_id')
    target_qty = int(request.form.get('target_qty', 0))
    actual_qty = int(request.form.get('actual_qty', 0))
    defect_qty = int(request.form.get('defect_qty', 0))
    defect_reason = request.form.get('defect_reason', '').strip()
    notes = request.form.get('notes', '').strip()
    qc_status = request.form.get('qc_status', 'approved')
    
    if actual_qty <= 0 or defect_qty > actual_qty:
        flash('Dữ liệu số lượng không hợp lệ.', 'danger')
        return redirect(url_for('production_list'))
        
    pass_qty = actual_qty - defect_qty
    defect_rate = round((defect_qty / actual_qty) * 100.0, 2)
    
    conn = get_db()
    conn.execute("""
        UPDATE production_logs 
        SET prod_date = ?, shift = ?, machine_id = ?, worker_id = ?, product_id = ?, 
            target_qty = ?, actual_qty = ?, pass_qty = ?, defect_qty = ?, 
            defect_rate = ?, defect_reason = ?, notes = ?, qc_status = ?
        WHERE id = ?
    """, (prod_date, shift, machine_id, worker_id, product_id, target_qty, actual_qty, pass_qty, defect_qty, defect_rate, defect_reason, notes, qc_status, log_id))
    conn.commit()
    conn.close()
    
    flash('Cập nhật bản ghi sản xuất thành công!', 'success')
    return redirect(url_for('production_list'))

@app.route('/production/delete/<int:log_id>', methods=['POST'])
@roles_required('admin', 'manager')
def production_delete(log_id):
    conn = get_db()
    conn.execute("DELETE FROM production_logs WHERE id = ?", (log_id,))
    conn.commit()
    conn.close()
    flash('Đã xóa bản ghi nhật ký sản xuất.', 'info')
    return redirect(url_for('production_list'))

@app.route('/production/export-csv')
@login_required
def production_export_csv():
    conn = get_db()
    logs = conn.execute("""
        SELECT 
            p.prod_date, p.shift, m.name as machine_name, w.full_name as worker_name, 
            pr.name as product_name, p.target_qty, p.actual_qty, p.pass_qty, 
            p.defect_qty, p.defect_rate, p.defect_reason, p.qc_status, p.notes
        FROM production_logs p
        JOIN workers w ON p.worker_id = w.id
        JOIN machines m ON p.machine_id = m.id
        JOIN products pr ON p.product_id = pr.id
        ORDER BY p.prod_date DESC
    """).fetchall()
    conn.close()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header tiếng Việt UTF-8 (với BOM để Excel đọc đúng tiếng Việt)
    writer.writerow([
        'Ngày sản xuất', 'Ca làm việc', 'Máy / Dây chuyền', 'Công nhân đứng máy',
        'Model máy điện', 'Số lượng KH', 'Số lượng Thực tế', 'Số lượng Đạt',
        'Số lượng Lỗi', 'Tỷ lệ lỗi (%)', 'Nguyên nhân lỗi', 'Trạng thái QC', 'Ghi chú'
    ])
    
    for row in logs:
        writer.writerow([
            row['prod_date'], row['shift'], row['machine_name'], row['worker_name'],
            row['product_name'], row['target_qty'], row['actual_qty'], row['pass_qty'],
            row['defect_qty'], f"{row['defect_rate']}%", row['defect_reason'], row['qc_status'], row['notes']
        ])
        
    output.seek(0)
    # Thêm UTF-8 BOM \ufeff để Excel mở không bị lỗi font
    response_data = '\ufeff' + output.getvalue()
    return Response(
        response_data,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment;filename=nhat_ky_san_xuat_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )

# --- WORKER MANAGEMENT (CÔNG NHÂN ĐỨNG MÁY) ---

@app.route('/workers')
@login_required
def workers_list():
    conn = get_db()
    workers = conn.execute("""
        SELECT 
            w.*,
            COUNT(p.id) as total_shifts,
            COALESCE(SUM(p.actual_qty), 0) as total_produced,
            COALESCE(SUM(p.defect_qty), 0) as total_defects,
            ROUND(CAST(COALESCE(SUM(p.defect_qty), 0) AS REAL) * 100.0 / NULLIF(COALESCE(SUM(p.actual_qty), 0), 0), 2) as defect_rate
        FROM workers w
        LEFT JOIN production_logs p ON w.id = p.worker_id
        GROUP BY w.id
        ORDER BY w.active DESC, w.id ASC
    """).fetchall()
    conn.close()
    return render_template('workers.html', workers=workers)

@app.route('/workers/add', methods=['POST'])
@roles_required('admin', 'manager')
def worker_add():
    worker_code = request.form.get('worker_code', '').strip().upper()
    full_name = request.form.get('full_name', '').strip()
    shift = request.form.get('shift', '')
    skill_level = request.form.get('skill_level', '')
    phone = request.form.get('phone', '').strip()
    
    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO workers (worker_code, full_name, shift, skill_level, phone)
            VALUES (?, ?, ?, ?, ?)
        """, (worker_code, full_name, shift, skill_level, phone))
        conn.commit()
        flash(f'Thêm công nhân {full_name} ({worker_code}) thành công!', 'success')
    except Exception as e:
        flash(f'Mã công nhân đã tồn tại hoặc lỗi dữ liệu: {str(e)}', 'danger')
    finally:
        conn.close()
        
    return redirect(url_for('workers_list'))

@app.route('/workers/edit/<int:worker_id>', methods=['POST'])
@roles_required('admin', 'manager')
def worker_edit(worker_id):
    worker_code = request.form.get('worker_code', '').strip().upper()
    full_name = request.form.get('full_name', '').strip()
    shift = request.form.get('shift', '')
    skill_level = request.form.get('skill_level', '')
    phone = request.form.get('phone', '').strip()
    active = 1 if request.form.get('active') == '1' else 0
    
    conn = get_db()
    try:
        conn.execute("""
            UPDATE workers 
            SET worker_code = ?, full_name = ?, shift = ?, skill_level = ?, phone = ?, active = ?
            WHERE id = ?
        """, (worker_code, full_name, shift, skill_level, phone, active, worker_id))
        conn.commit()
        flash('Cập nhật thông tin công nhân thành công!', 'success')
    except Exception as e:
        flash(f'Lỗi khi cập nhật: {str(e)}', 'danger')
    finally:
        conn.close()
        
    return redirect(url_for('workers_list'))

@app.route('/workers/delete/<int:worker_id>', methods=['POST'])
@roles_required('admin')
def worker_delete(worker_id):
    conn = get_db()
    try:
        conn.execute("DELETE FROM workers WHERE id = ?", (worker_id,))
        conn.commit()
        flash('Đã xóa công nhân.', 'info')
    except Exception as e:
        flash(f'Không thể xóa công nhân đã có nhật ký sản xuất: {str(e)}', 'danger')
    finally:
        conn.close()
    return redirect(url_for('workers_list'))

# --- MACHINE MANAGEMENT (MÁY MÓC & DÂY CHUYỀN) ---

@app.route('/machines')
@login_required
def machines_list():
    conn = get_db()
    machines = conn.execute("""
        SELECT 
            m.*,
            COUNT(p.id) as total_runs,
            COALESCE(SUM(p.actual_qty), 0) as total_output,
            COALESCE(SUM(p.defect_qty), 0) as total_defects,
            ROUND(CAST(COALESCE(SUM(p.defect_qty), 0) AS REAL) * 100.0 / NULLIF(COALESCE(SUM(p.actual_qty), 0), 0), 2) as defect_rate
        FROM machines m
        LEFT JOIN production_logs p ON m.id = p.machine_id
        GROUP BY m.id
        ORDER BY m.id ASC
    """).fetchall()
    conn.close()
    return render_template('machines.html', machines=machines)

@app.route('/machines/add', methods=['POST'])
@roles_required('admin', 'manager')
def machine_add():
    machine_code = request.form.get('machine_code', '').strip().upper()
    name = request.form.get('name', '').strip()
    machine_type = request.form.get('machine_type', '').strip()
    capacity = request.form.get('capacity', '').strip()
    location = request.form.get('location', '').strip()
    status = request.form.get('status', 'running')
    
    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO machines (machine_code, name, machine_type, capacity, location, status)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (machine_code, name, machine_type, capacity, location, status))
        conn.commit()
        flash(f'Thêm máy {name} ({machine_code}) thành công!', 'success')
    except Exception as e:
        flash(f'Mã máy đã tồn tại hoặc lỗi: {str(e)}', 'danger')
    finally:
        conn.close()
        
    return redirect(url_for('machines_list'))

@app.route('/machines/edit/<int:machine_id>', methods=['POST'])
@roles_required('admin', 'manager')
def machine_edit(machine_id):
    machine_code = request.form.get('machine_code', '').strip().upper()
    name = request.form.get('name', '').strip()
    machine_type = request.form.get('machine_type', '').strip()
    capacity = request.form.get('capacity', '').strip()
    location = request.form.get('location', '').strip()
    status = request.form.get('status', 'running')
    
    conn = get_db()
    try:
        conn.execute("""
            UPDATE machines 
            SET machine_code = ?, name = ?, machine_type = ?, capacity = ?, location = ?, status = ?
            WHERE id = ?
        """, (machine_code, name, machine_type, capacity, location, status, machine_id))
        conn.commit()
        flash('Cập nhật thông tin máy móc thành công!', 'success')
    except Exception as e:
        flash(f'Lỗi khi cập nhật máy móc: {str(e)}', 'danger')
    finally:
        conn.close()
        
    return redirect(url_for('machines_list'))

@app.route('/machines/delete/<int:machine_id>', methods=['POST'])
@roles_required('admin')
def machine_delete(machine_id):
    conn = get_db()
    try:
        conn.execute("DELETE FROM machines WHERE id = ?", (machine_id,))
        conn.commit()
        flash('Đã xóa máy.', 'info')
    except Exception as e:
        flash(f'Không thể xóa máy đã có dữ liệu sản xuất: {str(e)}', 'danger')
    finally:
        conn.close()
    return redirect(url_for('machines_list'))

# --- USER MANAGEMENT (QUẢN LÝ TÀI KHOẢN - ADMIN ONLY) ---

@app.route('/users')
@roles_required('admin')
def users_list():
    conn = get_db()
    users = conn.execute("SELECT id, username, full_name, role, email, created_at FROM users ORDER BY id ASC").fetchall()
    conn.close()
    return render_template('users.html', users=users)

@app.route('/users/add', methods=['POST'])
@roles_required('admin')
def user_add():
    username = request.form.get('username', '').strip()
    password = request.form.get('password', '').strip()
    full_name = request.form.get('full_name', '').strip()
    role = request.form.get('role', 'worker')
    email = request.form.get('email', '').strip()
    
    if not username or not password or not full_name:
        flash('Vui lòng điền đầy đủ các thông tin bắt buộc.', 'danger')
        return redirect(url_for('users_list'))
        
    pw_hash = hash_password(password)
    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO users (username, password_hash, full_name, role, email)
            VALUES (?, ?, ?, ?, ?)
        """, (username, pw_hash, full_name, role, email))
        conn.commit()
        flash(f'Tạo tài khoản {username} thành công!', 'success')
    except Exception as e:
        flash(f'Tên đăng nhập đã tồn tại: {str(e)}', 'danger')
    finally:
        conn.close()
        
    return redirect(url_for('users_list'))

@app.route('/users/edit/<int:user_id>', methods=['POST'])
@roles_required('admin')
def user_edit(user_id):
    full_name = request.form.get('full_name', '').strip()
    role = request.form.get('role', 'worker')
    email = request.form.get('email', '').strip()
    password = request.form.get('password', '').strip()
    
    conn = get_db()
    try:
        if password:
            pw_hash = hash_password(password)
            conn.execute("""
                UPDATE users SET full_name = ?, role = ?, email = ?, password_hash = ? WHERE id = ?
            """, (full_name, role, email, pw_hash, user_id))
        else:
            conn.execute("""
                UPDATE users SET full_name = ?, role = ?, email = ? WHERE id = ?
            """, (full_name, role, email, user_id))
        conn.commit()
        flash('Cập nhật tài khoản thành công!', 'success')
    except Exception as e:
        flash(f'Lỗi khi cập nhật user: {str(e)}', 'danger')
    finally:
        conn.close()
        
    return redirect(url_for('users_list'))

@app.route('/users/delete/<int:user_id>', methods=['POST'])
@roles_required('admin')
def user_delete(user_id):
    if user_id == session.get('user_id'):
        flash('Bạn không thể xóa tài khoản của chính mình!', 'danger')
        return redirect(url_for('users_list'))
        
    conn = get_db()
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    flash('Đã xóa tài khoản người dùng.', 'info')
    return redirect(url_for('users_list'))

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5050)
