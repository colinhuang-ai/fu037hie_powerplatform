-- Bảng Quản lý Người dùng
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'worker', -- 'admin', 'manager', 'worker'
    email TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Quản lý Công nhân đứng máy
CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    shift TEXT DEFAULT 'Ca 1 (06:00 - 14:00)',
    skill_level TEXT DEFAULT 'Bậc 3/7',
    phone TEXT,
    active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Quản lý Máy móc / Dây chuyền sản xuất máy điện
CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    machine_type TEXT NOT NULL, -- Máy quấn dây Stator, Máy ép Rotor, Máy đúc vỏ nhôm, Máy cân bằng động, Máy thử tải & cách điện...
    capacity TEXT,
    status TEXT DEFAULT 'running', -- 'running', 'maintenance', 'idle', 'error'
    location TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Danh mục Sản phẩm máy điện
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- Động cơ 3 pha, Động cơ 1 pha, Máy phát điện, Máy biến áp, Động cơ Servo...
    power_rating TEXT, -- 2.2 kW, 5.5 kW, 11 kW, 15 kVA...
    voltage TEXT, -- 220V, 380V, 3-phase...
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Nhật ký sản xuất máy điện
CREATE TABLE IF NOT EXISTS production_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prod_date DATE NOT NULL,
    shift TEXT NOT NULL, -- Ca 1, Ca 2, Ca 3
    machine_id INTEGER NOT NULL,
    worker_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    target_qty INTEGER NOT NULL DEFAULT 0,
    actual_qty INTEGER NOT NULL DEFAULT 0,
    pass_qty INTEGER NOT NULL DEFAULT 0,
    defect_qty INTEGER NOT NULL DEFAULT 0,
    defect_rate REAL NOT NULL DEFAULT 0.0, -- Tỷ lệ % lỗi = (defect_qty / actual_qty) * 100
    defect_reason TEXT, -- Phân loại nguyên nhân lỗi
    notes TEXT,
    qc_status TEXT DEFAULT 'approved', -- 'approved', 'pending', 'rejected'
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (machine_id) REFERENCES machines(id),
    FOREIGN KEY (worker_id) REFERENCES workers(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_prod_date ON production_logs(prod_date);
CREATE INDEX IF NOT EXISTS idx_prod_worker ON production_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_prod_machine ON production_logs(machine_id);
