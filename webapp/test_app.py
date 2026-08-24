import unittest
from app import app
from database import init_db, get_db

class ElectricMotorAppTestCase(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        self.client = app.test_client()
        init_db()

    def login(self, username, password):
        return self.client.post('/login', data=dict(
            username=username,
            password=password
        ), follow_redirects=True)

    def test_login_success(self):
        response = self.login('admin', 'admin123')
        self.assertEqual(response.status_code, 200)
        self.assertIn('Dashboard Tổng Quan'.encode('utf-8'), response.data)

    def test_login_failure(self):
        response = self.login('admin', 'wrongpass')
        self.assertEqual(response.status_code, 200)
        self.assertIn('Tên đăng nhập hoặc mật khẩu không chính xác'.encode('utf-8'), response.data)

    def test_dashboard_api_chart_data(self):
        self.login('admin', 'admin123')
        response = self.client.get('/api/chart-data')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn('daily', data)
        self.assertIn('reasons', data)
        self.assertIn('products', data)
        self.assertTrue(len(data['daily']['dates']) > 0)

    def test_production_add_and_rate_calculation(self):
        self.login('admin', 'admin123')
        # Thêm bản ghi: Kế hoạch 100, Thực tế 100, Lỗi 4 => Đạt 96, Tỷ lệ lỗi 4%
        response = self.client.post('/production/add', data=dict(
            prod_date='2026-08-17',
            shift='Ca 1',
            machine_id=1,
            worker_id=1,
            product_id=1,
            target_qty=100,
            actual_qty=100,
            defect_qty=4,
            defect_reason='Chập vòng dây cuộn Stator',
            notes='Test production unit test',
            qc_status='approved'
        ), follow_redirects=True)
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('Thêm bản ghi nhật ký sản xuất thành công'.encode('utf-8'), response.data)
        
        # Verify in DB
        conn = get_db()
        row = conn.execute("SELECT * FROM production_logs WHERE notes = 'Test production unit test'").fetchone()
        conn.close()
        self.assertIsNotNone(row)
        self.assertEqual(row['pass_qty'], 96)
        self.assertEqual(row['defect_rate'], 4.0)

    def test_csv_export(self):
        self.login('admin', 'admin123')
        response = self.client.get('/production/export-csv')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, 'text/csv')
        self.assertIn('Ngày sản xuất'.encode('utf-8'), response.data)

    def test_workers_and_machines_access(self):
        self.login('admin', 'admin123')
        res_workers = self.client.get('/workers')
        self.assertEqual(res_workers.status_code, 200)
        self.assertIn('Công Nhân Vận Hành Máy Điện'.encode('utf-8'), res_workers.data)

        res_machines = self.client.get('/machines')
        self.assertEqual(res_machines.status_code, 200)
        self.assertIn('Dây Chuyền Sản Xuất Máy Điện'.encode('utf-8'), res_machines.data)

if __name__ == '__main__':
    unittest.main()
