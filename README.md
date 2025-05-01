# 🧥 DressUp – Elevate Your Style
DressUp is a modern e-commerce platform built for boys' clothing. Designed with both users and admins in mind, it offers a full suite of features including user authentication, product browsing, cart and wishlist management, order processing, admin dashboards, PDF reports, and more.

# 🛠 Tech Stack
Backend: Node.js, Express.js, MongoDB

Security: Helmet, CORS, Rate Limiting, JWT

Email Services: Nodemailer, Gmail OAuth

PDF Reports: PDFKit, Chart.js

User-Agent Tracking: express-useragent

# 👨‍💼 Admin Credentials

Email:    admin@gmail.com  
Password: Admin@123

# 🔗 API Endpoints
🔐 Auth
POST /api/v1/auth/register – Register a user

POST /api/v1/auth/login – User login

POST /api/v1/auth/admin/login – Admin login

GET /api/v1/auth/me – Current user

GET /api/v1/auth/logout – Logout

👕 Products
GET /api/v1/products – All products

GET /api/v1/products/:id – Single product

POST /api/v1/products/:id/reviews – Add review

GET /api/v1/products/:id/reviews – Get reviews

DELETE /api/v1/reviews/:id – Delete review

🛒 Cart
GET /api/v1/cart – User cart

POST /api/v1/cart – Add to cart

PUT /api/v1/cart/:itemId – Update cart item

DELETE /api/v1/cart/:itemId – Remove item

DELETE /api/v1/cart – Clear cart

📦 Orders
POST /api/v1/orders – Place order

GET /api/v1/orders/myorders – My orders

GET /api/v1/orders/:id – Single order

DELETE /api/v1/orders/:id – Cancel order

GET /api/v1/orders/:id/pdf – PDF receipt

PUT /api/v1/orders/:id/deliver – Mark as delivered (admin)

❤️ Wishlist
GET /api/v1/wishlist – View wishlist

POST /api/v1/wishlist – Add to wishlist

DELETE /api/v1/wishlist/:itemId – Remove from wishlist

POST /api/v1/wishlist/:itemId/move-to-cart – Move to cart

👤 Users
GET /api/v1/users/me – Get profile

PUT /api/v1/users/me – Update profile

PUT /api/v1/users/updatepassword – Change password

DELETE /api/v1/users/me – Delete account

# 🛠 Admin Functionalities

👥 Users Management
GET /api/v1/admin/users – All users

GET /api/v1/admin/users/:id – Single user

POST /api/v1/admin/users – Create user

PUT /api/v1/admin/users/:id – Update user

DELETE /api/v1/admin/users/:id – Delete user

GET /api/v1/admin/users-list/pdf – PDF user list

🧢 Product Management
GET /api/v1/admin/products – All products

POST /api/v1/admin/products – Create product

PUT /api/v1/admin/products/:id – Update product

DELETE /api/v1/admin/products/:id – Delete product

GET /api/v1/admin/products-list/pdf – PDF product list

📋 Orders Management
GET /api/v1/admin/orders – All orders

GET /api/v1/admin/orders/:id – Single order

PUT /api/v1/admin/orders/:id – Update order

DELETE /api/v1/admin/orders/:id – Delete order

GET /api/v1/admin/orders-list/pdf – PDF order list

GET /api/v1/admin/sales-report/pdf – Sales report in PDF

📊 Dashboard
GET /api/v1/admin/dashboard-stats – Dashboard stats

📦 Project Setup
Prerequisites
Node.js and npm

MongoDB instance (local or Atlas)

.env file with environment variables (e.g., DB URI, JWT secret, email credentials)

Installation
bash
Copy
Edit
git clone https://github.com/your-username/dressup.git
cd dressup
npm install
Run Server
bash
Copy
Edit
npm run dev

# 📁 Dependencies
Key dependencies used in the project:

json
Copy
Edit
{
  "express": "^4.18.2",
  "mongoose": "^8.13.2",
  "jsonwebtoken": "^9.0.2",
  "bcryptjs": "^3.0.2",
  "nodemailer": "^6.10.0",
  "pdfkit": "^0.16.0",
  "chart.js": "^4.4.9",
  "chartjs-node-canvas": "^5.0.0",
  "helmet": "^8.1.0",
  "cors": "^2.8.5",
  "dotenv": "^16.4.7"
}
✨ Features Summary
🔒 Secure user authentication with JWT

🛍 Product browsing, reviews, cart, wishlist

📦 Full order lifecycle: create, cancel, deliver, receipt

📄 PDF generation for receipts, user lists, product lists, orders, and sales reports

📊 Admin dashboard with stats and reports

📧 Email notifications via Nodemailer