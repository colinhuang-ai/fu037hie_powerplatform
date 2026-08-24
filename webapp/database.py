import sqlite3
import os
import hashlib
import secrets
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), 'production.db')
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'schema.sql')

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
    return f"{salt}${hashed}"

def verify_password(password: str, hashed_str: str) -> bool:
    if not hashed_str or '$' not in hashed_str:
        return False
    salt, hashed = hashed_str.split('$', 1)
    test_hash = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
    return secrets.compare_digest(test_hash, hashed)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db(force_reseed=False):
    conn = get_db()
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        conn.executescript(f.read())
    
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]
    if count == 0 or force_reseed:
        if force_reseed:
            conn.execute("DELETE FROM production_logs")
            conn.execute("DELETE FROM users")
            conn.execute("DELETE FROM workers")
            conn.execute("DELETE FROM machines")
            conn.execute("DELETE FROM products")
        seed_data(conn)
    conn.commit()
    conn.close()

def seed_data(conn):
    cursor = conn.cursor()
    
    # 1. Thêm Users mẫu với mật khẩu chính xác
    users = [
        ('admin', hash_password('admin123'), 'Trần Hoàng Admin', 'admin', 'admin@maydien.vn'),
        ('quanly', hash_password('quanly123'), 'Nguyễn Văn Quản Lý', 'manager', 'quanly@maydien.vn'),
        ('congnhan', hash_password('congnhan123'), 'Lê Văn Thắng', 'worker', 'thang.lv@maydien.vn'),
        ('qc_lead', hash_password('123456'), 'Phạm Minh Kiểm Soát QC', 'manager', 'qc@maydien.vn'),
    ]
    cursor.executemany(
        "INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)",
        users
    )
    
    # 2. Thêm Danh sách Công nhân đứng máy
    workers = [
        ('CN-001', 'Lê Văn Thắng', 'Ca 1 (06:00 - 14:00)', 'Bậc 5/7', '0912345601', 1),
        ('CN-002', 'Nguyễn Tiến Dũng', 'Ca 1 (06:00 - 14:00)', 'Bậc 4/7', '0912345602', 1),
        ('CN-003', 'Hoàng Văn Nam', 'Ca 2 (14:00 - 22:00)', 'Bậc 6/7', '0912345603', 1),
        ('CN-004', 'Vũ Quốc Huy', 'Ca 2 (14:00 - 22:00)', 'Bậc 3/7', '0912345604', 1),
        ('CN-005', 'Trần Đình Trọng', 'Ca 3 (22:00 - 06:00)', 'Bậc 4/7', '0912345605', 1),
        ('CN-006', 'Đỗ Quang Hải', 'Ca 3 (22:00 - 06:00)', 'Bậc 5/7', '0912345606', 1),
        ('CN-007', 'Phạm Đức Huy', 'Ca 1 (06:00 - 14:00)', 'Bậc 3/7', '0912345607', 1),
        ('CN-008', 'Bùi Hoàng Việt', 'Ca 2 (14:00 - 22:00)', 'Bậc 4/7', '0912345608', 1),
    ]
    cursor.executemany(
        "INSERT INTO workers (worker_code, full_name, shift, skill_level, phone, active) VALUES (?, ?, ?, ?, ?, ?)",
        workers
    )
    
    # 3. Thêm Danh mục Máy móc sản xuất máy điện
    machines = [
        ('M-QD01', 'Máy quấn dây tự động CNC Stator 01', 'Quấn dây Stator', '120 cuộn/giờ', 'running', 'Xưởng A - Chuyền 1'),
        ('M-QD02', 'Máy quấn dây tự động CNC Stator 02', 'Quấn dây Stator', '120 cuộn/giờ', 'running', 'Xưởng A - Chuyền 2'),
        ('M-EP01', 'Máy ép định hình lõi thép Rotor 01', 'Ép lõi thép', '80 rotor/giờ', 'running', 'Xưởng A - Chuyền Ép'),
        ('M-DC01', 'Máy đúc áp lực vỏ động cơ nhôm', 'Đúc vỏ', '50 vỏ/giờ', 'running', 'Xưởng B - Cơ khí'),
        ('M-CB01', 'Máy cân bằng động kỹ thuật số Rotor', 'Cân bằng động', '100 cái/giờ', 'running', 'Xưởng B - Lắp ráp'),
        ('M-TT01', 'Băng thử nghiệm cách điện & thử tải động cơ', 'Kiểm tra QC', '60 máy/giờ', 'running', 'Phòng QC & Test Bench'),
        ('M-LR01', 'Dây chuyền lắp ráp hoàn thiện & đóng nắp', 'Lắp ráp hoàn thiện', '90 máy/giờ', 'maintenance', 'Xưởng C - Đóng gói'),
    ]
    cursor.executemany(
        "INSERT INTO machines (machine_code, name, machine_type, capacity, status, location) VALUES (?, ?, ?, ?, ?, ?)",
        machines
    )
    
    # 4. Thêm Danh mục Sản phẩm máy điện
    products = [
        ('SP-M3P-2.2', 'Động cơ 3 pha không đồng bộ 2.2kW (3HP)', 'Động cơ 3 pha', '2.2 kW (3HP)', '380V / 50Hz'),
        ('SP-M3P-5.5', 'Động cơ 3 pha không đồng bộ 5.5kW (7.5HP)', 'Động cơ 3 pha', '5.5 kW (7.5HP)', '380V / 50Hz'),
        ('SP-M3P-11', 'Động cơ 3 pha công nghiệp 11kW (15HP)', 'Động cơ 3 pha', '11 kW (15HP)', '380V / 50Hz'),
        ('SP-M1P-1.5', 'Động cơ 1 pha vỏ nhôm 1.5kW (2HP)', 'Động cơ 1 pha', '1.5 kW (2HP)', '220V / 50Hz'),
        ('SP-GEN-5K', 'Máy phát điện xoay chiều đồng bộ 5kVA', 'Máy phát điện', '5.0 kVA', '220V/380V'),
        ('SP-MBA-25K', 'Máy biến áp phân phối hạ thế 25kVA', 'Máy biến áp', '25 kVA', '380V / 220V'),
    ]
    cursor.executemany(
        "INSERT INTO products (product_code, name, category, power_rating, voltage) VALUES (?, ?, ?, ?, ?)",
        products
    )
    
    # 5. Thêm Dữ liệu Nhật ký sản xuất mẫu phong phú trong 14 ngày qua
    today = datetime.now().date()
    reasons_pool = [
        "Chập vòng dây cuộn Stator",
        "Rotor bị lệch tâm rung vượt chuẩn",
        "Cách điện không đạt tiêu chuẩn (rò điện áp)",
        "Nứt vỏ nhôm khi ép bạc đạn",
        "Kẹt ổ bi / tiếng ồn cơ khí",
        "Sai lệch khe hở không khí giữa Rotor & Stator",
        "Lớp sơn cách điện bị bong tróc",
        "Cháy cuộn dây khi thử non tải"
    ]
    
    import random
    random.seed(42)
    
    logs = []
    for day_offset in range(13, -1, -1):
        log_date = (today - timedelta(days=day_offset)).strftime('%Y-%m-%d')
        
        # Mỗi ngày tạo 2 đến 4 ca sản xuất trên các máy khác nhau
        num_shifts = random.randint(2, 4)
        for _ in range(num_shifts):
            shift_name = random.choice(['Ca 1', 'Ca 2', 'Ca 3'])
            machine_id = random.randint(1, 6)
            worker_id = random.randint(1, 8)
            product_id = random.randint(1, 6)
            target = random.choice([50, 60, 80, 100, 120, 150])
            
            # Tính toán thực tế
            actual = int(target * random.uniform(0.92, 1.05))
            defect_pct = random.uniform(0.015, 0.085) # 1.5% đến 8.5%
            defect = max(1, int(actual * defect_pct))
            pass_qty = actual - defect
            rate = round((defect / actual) * 100, 2)
            
            reason = random.choice(reasons_pool) if defect > 0 else "Không có lỗi"
            qc_status = 'approved' if rate <= 5.0 else random.choice(['approved', 'pending', 'rejected'])
            notes = f"Sản xuất lô máy điện {log_date} - {shift_name}. Máy hoạt động ổn định."
            if rate > 5.0:
                notes += f" Lưu ý: Tỷ lệ lỗi {rate}% vượt mức kiểm soát, đã chuyển QC kiểm tra."

            logs.append((
                log_date, shift_name, machine_id, worker_id, product_id,
                target, actual, pass_qty, defect, rate, reason, notes, qc_status, 1
            ))
            
    cursor.executemany(
        """INSERT INTO production_logs 
        (prod_date, shift, machine_id, worker_id, product_id, target_qty, actual_qty, pass_qty, defect_qty, defect_rate, defect_reason, notes, qc_status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        logs
    )

if __name__ == '__main__':
    init_db()
    print("Database initialized & seeded successfully!")
