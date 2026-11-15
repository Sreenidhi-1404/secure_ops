# SecureOps – Security Workforce Management & Deployment Platform

A full-stack web application designed to simplify and manage security workforce operations, guard deployments, attendance, leave management, payroll, and workforce monitoring through a centralized platform.

---

## 📌 Project Overview

**SecureOps** is a Security Workforce Management and Deployment Platform developed to help security agencies efficiently manage their workforce and daily operations.

The platform provides a centralized system for managing security guards, client organizations, branches, security sites, posts, deployments, attendance, leave requests, replacements, and payroll.

It aims to reduce manual administrative work, improve workforce visibility, prevent deployment conflicts, and support efficient decision-making through dashboards and operational analytics.

## 🎯 Objectives

- Centralize security workforce information.
- Simplify guard and client management.
- Manage security sites, posts, and guard deployments.
- Monitor attendance and leave requests.
- Prevent conflicting guard assignments.
- Maintain guard replacement records.
- Improve payroll management.
- Provide operational insights through dashboards.
- Implement secure authentication and role-based access control.

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React.js, Vite, JavaScript, CSS |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| Authentication | JWT Authentication |
| Authorization | Role-Based Access Control (RBAC) |
| API Testing | Swagger UI |
| Database Management | pgAdmin 4 |
| Version Control | Git & GitHub |

## ✨ Key Features

### 1. Authentication and Authorization
- Secure user authentication.
- JWT-based authentication.
- Role-Based Access Control (RBAC).
- Protected application routes and operations.

### 2. Client Management
- Manage client organizations.
- Maintain client information.
- Associate branches and operational sites with clients.

### 3. Branch Management
- Create and manage client branches.
- Maintain branch information.
- Associate branches with their respective clients.

### 4. Site Management
- Manage security service locations.
- Organize sites under branches.
- Maintain site-related information.

### 5. Security Post Management
- Create and manage security posts.
- Configure required guard capacity.
- Define shift requirements.
- Monitor post availability.

### 6. Security Guard Management
- Register and manage security guards.
- Maintain guard information and unique identification.
- Track employment status.
- Validate guard information before operations.

### 7. Guard Deployment Management
- Assign guards to security posts.
- Manage deployment dates and shifts.
- Validate deployment availability.
- Prevent conflicting active deployments.
- Enforce security post capacity requirements.

### 8. Guard Replacement Management
- Replace an assigned guard when necessary.
- Maintain replacement history.
- Record outgoing and incoming guards.
- Track replacement dates and reasons.

### 9. Attendance Management
- Manage guard attendance records.
- Track check-in and check-out information.
- Validate attendance against approved leave.

### 10. Leave Management
- Submit and manage leave requests.
- Track leave status.
- Support approval and rejection workflows.
- Prevent attendance operations that conflict with approved leave.

### 11. Payroll Management
- Manage payroll information.
- Track payment status.
- Monitor payroll summaries.

### 12. Dashboard and Analytics
- Centralized operational dashboard.
- Workforce and deployment summaries.
- Guards currently on leave.
- Replacement alerts.
- Operational statistics and reporting.

## 🏗️ System Architecture

SecureOps follows a three-layer architecture:

```text
                USER
                  |
                  v
       REACT FRONTEND (VITE)
                  |
                  | HTTP / REST API
                  v
          FASTAPI BACKEND
                  |
          JWT AUTHENTICATION
                  |
          BUSINESS LOGIC
                  |
             SQLALCHEMY
                  |
                  v
          POSTGRESQL DATABASE
```

### Architecture Components

**Frontend**
- Provides the user interface.
- Handles forms, tables, navigation, and dashboards.
- Communicates with the backend through REST APIs.

**Backend**
- Handles business logic and validation.
- Exposes REST API endpoints using FastAPI.
- Manages authentication and authorization.
- Processes workforce and deployment operations.

**Database**
- PostgreSQL stores application data.
- SQLAlchemy manages database interactions.

## 📂 Project Structure

The project is organized into separate frontend and backend applications.

```text
secureops/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── app/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── routers/
│   │   ├── database.py
│   │   └── main.py
│   ├── requirements.txt
│   └── myvenv/
│
├── .gitignore
└── README.md
```

*Note: This is a representative structure. Refer to the actual project folders for the complete and current file organization.*

## ⚙️ Installation and Setup

### Prerequisites

Install the following before running the application:

- Python 3.10 or above.
- Node.js and npm.
- PostgreSQL.
- pgAdmin 4.
- Git.

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

Navigate into the project:

```bash
cd secureops
```

### 2. Backend Setup

Navigate to the backend folder:

```bash
cd backend
```

Create a virtual environment if one does not already exist:

```bash
python -m venv myvenv
```

Activate the virtual environment in Windows PowerShell:

```powershell
myvenv\Scripts\Activate.ps1
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

### 3. PostgreSQL Database Setup

1. Open PostgreSQL using pgAdmin 4.
2. Create a new database for SecureOps.
3. Configure the database connection using the environment variables expected by the backend.
4. Never commit actual database credentials to GitHub.

Example environment configuration (adjust variable names to match the backend configuration):

```env
DATABASE_URL=postgresql://username:password@localhost:5432/secureops
SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Create a local `.env` file in the appropriate backend location and configure the values required by the application.

### 4. Start the Backend Server

From the backend directory:

```bash
uvicorn app.main:app --reload
```

Backend server:

```text
http://127.0.0.1:8000
```

### 5. Access API Documentation

FastAPI automatically provides interactive API documentation.

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

ReDoc:

```text
http://127.0.0.1:8000/redoc
```

### 6. Frontend Setup

Open a new terminal and navigate to the frontend directory:

```bash
cd frontend
```

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Frontend application:

```text
http://localhost:5173/
```

## 🔗 API Modules

The backend provides REST API endpoints for different application modules.

| Module | API Prefix |
|---|---|
| Clients | `/clients` |
| Branches | `/branches` |
| Sites | `/sites` |
| Security Posts | `/security-posts` |
| Guards | `/guards` |
| Deployments | `/deployments` |
| Attendance | `/attendance` |
| Leave Management | `/leaves` |
| Payroll | `/payroll` |
| Dashboard | `/dashboard` |

For the complete list of endpoints, request schemas, and response formats, refer to the Swagger documentation.

## 🔐 Security Considerations

- JWT-based authentication.
- Role-based access control.
- Protected API endpoints.
- Input validation and error handling.
- Secure storage of environment variables.
- Database credentials excluded from version control.
- Authorization checks for sensitive operations.

## 🧪 Testing

The application can be tested using:

- FastAPI Swagger UI for backend API testing.
- Browser testing for frontend functionality.
- PostgreSQL and pgAdmin for database verification.
- Manual testing of CRUD operations and business rules.

Important workflows to verify include guard registration, deployment assignment, deployment capacity validation, attendance, leave approval, guard replacement, and payroll operations.

## 🚀 Future Enhancements

The following features are potential future improvements:

- OCR-based receipt and document scanning.
- Automated document information extraction.
- Predictive workforce analytics.
- Budget management and expense tracking.
- Advanced operational reporting.
- Enhanced dashboard visualizations.
- Automated notifications and alerts.
- Advanced workforce planning.

## 🌱 Project Impact

SecureOps aims to improve the efficiency and reliability of security workforce operations by providing a centralized digital management system.

It supports better workforce allocation, operational transparency, accurate record maintenance, and streamlined administrative processes.

## 👩‍💻 Development

**Project Name:** SecureOps – Security Workforce Management & Deployment Platform

**Domain:** Full Stack Web Development

**Frontend:** React.js

**Backend:** Python FastAPI

**Database:** PostgreSQL

**ORM:** SQLAlchemy

**Version Control:** Git & GitHub

---

## 📄 License

This project is developed for educational and demonstration purposes. Add an appropriate open-source or proprietary license before distributing it publicly.

---

**SecureOps – Smarter Workforce Management. Better Security Operations.**