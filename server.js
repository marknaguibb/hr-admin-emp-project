const express = require('express');
const {sql, connectDB } = require('./db.js');
const app = express();
let pool;

const path = require("path");

app.use(express.static(path.join(__dirname, "public")));


app.use(express.json());
path.join(__dirname, "public");

async function startServer() {
    try {
        pool = await connectDB();
        
        app.post("/login", (req, res) => {
            const { id, password } = req.body;
            if (id === "adminId" && password === "password") {
                return res.json({ success: true, dashboard: "/dashboard" });
            }
            res.status(401).json({ success: false, message: "Invalid Admin ID or Password." });
        });
        
        app.get("/dashboard", (req, res) => {
            res.sendFile(__dirname + '/public/dashboards/admin_dashboard.html');
        });



app.post('/admin/remove-deductions', async (req, res) => {
    const { status } = req.body; 
    try {
        const result = await pool.request()
            .input('status', sql.VarChar(50), status)
            .query(`
                UPDATE Deduction
                SET amount = 0, status='finalized'
                WHERE emp_ID IN (SELECT employee_id FROM Employee WHERE employment_status=@status)
            `);
        res.json({ success: true, message: `Deductions removed for all employees with status '${status}'` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error while removing deductions' });
    }
});

app.post('/admin/initiate-attendance', async (req, res) => {
    try {
        await pool.request().query(`
            INSERT INTO Attendance (emp_ID, date, status)
            SELECT employee_id, CAST(GETDATE() AS DATE), 'Absent'
            FROM Employee
            WHERE NOT EXISTS (
                SELECT 1 FROM Attendance 
                WHERE emp_ID = Employee.employee_id 
                AND date = CAST(GETDATE() AS DATE)
            )
        `);
        res.json({ success: true, message: "Today's attendance initiated for all employees!" });
    } catch (err) {
        console.error('Error initiating attendance:', err);
        res.status(500).json({ success: false, error: 'Server error while initiating attendance' });
    }
});
app.post('/admin/add-holiday', async (req, res) => {
    const { holiday_name, from_date, to_date } = req.body;

    if (!holiday_name || !from_date || !to_date) {
        return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    try {
        await pool.request()
            .input('holiday_name', sql.VarChar(50), holiday_name)
            .input('from_date', sql.Date, from_date)
            .input('to_date', sql.Date, to_date)
            .execute('Add_Holiday');

        res.json({ success: true, message: 'Holiday added successfully!' });
    } catch (err) {
        console.error('Error adding holiday:', err);
        res.status(500).json({ success: false, error: 'Server error while adding holiday.' });
    }
});

app.get('/admin/get-holidays', async (req, res) => {
    try {
        const result = await pool.request().query('SELECT holiday_name, holiday_date FROM Official_Holidays ORDER BY holiday_date');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching holidays:', err);
        res.status(500).json({ error: 'Failed to fetch holidays.' });
    }
});

app.post('/admin/update-attendance', async (req, res) => {
    const { emp_ID, status } = req.body;

    if (!emp_ID || !status) {
        return res.status(400).json({ success: false, error: 'Missing Employee ID or Status.' });
    }

    try {
        await pool.request()
            .input('emp_ID', sql.Int, emp_ID)
            .input('status', sql.VarChar(50), status)
            .query(`
                UPDATE Attendance
                SET status = @status
                WHERE emp_ID = @emp_ID AND date = CAST(GETDATE() AS DATE)
            `);

        res.json({ success: true, message: "Attendance updated successfully!" });
    } catch (err) {
        console.error('Error updating attendance:', err);
        res.status(500).json({ success: false, error: 'Server error while updating attendance.' });
    }
});

        app.get("/api/metrics", async (req, res) => {
            try {
                const totalEmp = await pool.request().query('SELECT COUNT(*) as total FROM Employee');
                const activeDepts = await pool.request().query('SELECT COUNT(DISTINCT name) as total FROM Department');
                const absentees = await pool.request().query(`
                    SELECT COUNT(*) as total FROM Attendance 
                    WHERE date = CAST(GETDATE() AS DATE) AND status = 'Absent'
                `);
                const resigned = await pool.request().query(`
                    SELECT COUNT(*) as total FROM Employee 
                    WHERE employment_status = 'resigned'
                `);

                res.json({
                    totalEmployees: totalEmp.recordset[0].total,
                    activeDepartments: activeDepts.recordset[0].total,
                    todayAbsentees: absentees.recordset[0].total,
                    resignedEmployees: resigned.recordset[0].total
                });
            } catch (err) {
                console.error('Metrics API error:', err);
                res.status(500).json({ error: 'Failed to fetch metrics', details: err.message });
            }
        });
app.get("/admin/employees-per-department", async (req, res) => {
    try {
        const result = await sql.query(`
            SELECT dept_name, COUNT(*) AS count
            FROM Employee
            GROUP BY dept_name;
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching employees per department:", err);
        res.status(500).json({ error: "Server error" });
    }
});
app.get('/admin/rejected-medical-leaves', async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT L.request_ID, M.Emp_ID, L.start_date, L.final_approval_status
            FROM Leave L
            JOIN Medical_Leave M ON L.request_ID = M.request_ID
            WHERE L.final_approval_status = 'Rejected'
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching rejected medical leaves:', err);
        res.status(500).json({ error: 'Server error while fetching rejected medical leaves' });
    }
});

app.get("/admin/pending-leaves", async (req, res) => {
    try {
        const result = await pool.request()
            .query(`
                SELECT request_ID, Emp_ID, leave_type, start_date, end_date, num_days, status
                FROM Leave
                WHERE status = 'Pending' OR final_approval_status = 'Pending'
                ORDER BY start_date ASC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching pending leaves:", err);
        res.status(500).json({ error: "Failed to fetch pending leaves", details: err.message });
    }
});



app.post("/admin/save-employee", async (req, res) => {
    const {
        employee_id,
        first_name,
        last_name,
        email,
        department,
        status,
        type_of_contract,
        years_of_experience,
        salary,
        password,
        deductions
    } = req.body;

    try {
        if (!first_name || !last_name || !email || !department || !status || !type_of_contract) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        if (!employee_id) {
            await pool.request()
                .input('first_name', sql.VarChar(50), first_name)
                .input('last_name', sql.VarChar(50), last_name)
                .input('email', sql.VarChar(100), email)
                .input('department', sql.VarChar(50), department)
                .input('employment_status', sql.VarChar(50), status)
                .input('type_of_contract', sql.VarChar(50), type_of_contract)
                .input('years_of_experience', sql.Int, years_of_experience || 0)
                .input('salary', sql.Money, salary || 0)
                .input('password', sql.VarChar(255), password)
                .execute('InsertOrUpdate_Employee');
        } else {
            
            await pool.request()
                .input('Employee_ID', sql.Int, employee_id)
                .input('first_name', sql.VarChar(50), first_name)
                .input('last_name', sql.VarChar(50), last_name)
                .input('email', sql.VarChar(100), email)
                .input('department', sql.VarChar(50), department)
                .input('employment_status', sql.VarChar(50), status)
                .input('type_of_contract', sql.VarChar(50), type_of_contract)
                .input('years_of_experience', sql.Int, years_of_experience || 0)
                .input('salary', sql.Money, salary || 0)
                .input('password', sql.VarChar(255), password)
                .execute('InsertOrUpdate_Employee');
        }

        res.json({ success: true, message: "Employee saved successfully!" });
    } catch (err) {
        console.error("Error saving employee:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post("/api/employee/save", async (req, res) => {
    const {
        employee_id,
        first_name,
        last_name,
        email,
        department,
        status,
        type_of_contract,
        years_of_experience,
        salary,
        password,
        deductions
    } = req.body;

    try {
        if (!first_name || !last_name || !email || !department || !status) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        if (!employee_id) {
            
            await pool.request()
                .input('first_name', sql.VarChar(50), first_name)
                .input('last_name', sql.VarChar(50), last_name)
                .input('email', sql.VarChar(100), email)
                .input('department', sql.VarChar(50), department)
                .input('employment_status', sql.VarChar(50), status)
                .input('type_of_contract', sql.VarChar(50), type_of_contract || 'Full Time')
                .input('years_of_experience', sql.Int, parseInt(years_of_experience) || 0)
                .input('salary', sql.Money, parseFloat(salary) || 0)
                .input('password', sql.VarChar(255), password)
                .query(`
                    INSERT INTO Employee (first_name, last_name, email, dept_name, employment_status, type_of_contract, years_of_experience, salary, password, deductions)
                    VALUES (@first_name, @last_name, @email, @department, @employment_status, @type_of_contract, @years_of_experience, @salary, @password, ${parseFloat(deductions) || 0})
                `);
        } else {
            
            await pool.request()
                .input('employee_id', sql.Int, parseInt(employee_id))
                .input('first_name', sql.VarChar(50), first_name)
                .input('last_name', sql.VarChar(50), last_name)
                .input('email', sql.VarChar(100), email)
                .input('department', sql.VarChar(50), department)
                .input('employment_status', sql.VarChar(50), status)
                .input('type_of_contract', sql.VarChar(50), type_of_contract || 'Full Time')
                .input('years_of_experience', sql.Int, parseInt(years_of_experience) || 0)
                .input('salary', sql.Money, parseFloat(salary) || 0)
                .input('password', sql.VarChar(255), password)
                .query(`
                    UPDATE Employee SET 
                        first_name = @first_name,
                        last_name = @last_name,
                        email = @email,
                        dept_name = @department,
                        employment_status = @employment_status,
                        type_of_contract = @type_of_contract,
                        years_of_experience = @years_of_experience,
                        salary = @salary,
                        password = @password,
                        deductions = ${parseFloat(deductions) || 0}
                    WHERE employee_id = @employee_id
                `);
        }

        res.json({ success: true, message: "Employee saved successfully!" });
    } catch (err) {
        console.error("Error saving employee:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});
app.get('/attendance/yesterday', async (req, res) => {
    try {
        await sql.connect(sqlConfig);

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yDateStr = yesterday.toISOString().split('T')[0]; 

        const result = await sql.query`
            SELECT a.emp_ID, e.name, a.status, a.check_in_time, a.check_out_time
            FROM Attendance a
            JOIN Employee e ON a.emp_ID = e.emp_ID
            WHERE a.date = ${yDateStr}
        `;

        res.json({ date: yDateStr, records: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch yesterday attendance' });
    }
});

app.get('/performance/winter', async (req, res) => {
    try {
        await sql.connect(sqlConfig);

        const result = await sql.query`
            SELECT 
                e.employee_id AS emp_ID,
                CONCAT(e.first_name, ' ', e.last_name) AS name,
                COUNT(*) AS semester_count,
                ISNULL(AVG(p.rating),0) AS avg_score,
                ISNULL(MAX(p.performance_ID),0) AS latest_performance_id
            FROM Performance p
            JOIN Employee e ON p.emp_ID = e.employee_id
            WHERE p.semester = 'Win'
            GROUP BY e.employee_id, e.first_name, e.last_name
            ORDER BY AVG(p.rating) DESC
        `;

        res.json({ records: result.recordset || [] });

    } catch (err) {
        console.error('SQL ERROR:', err);  
        res.status(500).json({ error: 'Failed to fetch winter performance' });
    }
});



app.get("/api/employees", async (req, res) => {
    try {
        const result = await pool.request().query('SELECT * FROM Employee');
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching employees:', err);
        res.status(500).json({ error: 'Failed to fetch employees', details: err.message });
    }
});

        app.listen(5000, () => console.log("Server running on http://localhost:5000"));
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

startServer();

