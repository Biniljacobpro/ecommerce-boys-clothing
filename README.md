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

# 🔐 Authentication

POST	     /api/v1/auth/register	     Register user

POST	     /api/v1/auth/login	         Login user

POST	     /api/v1/auth/admin/login	   Admin login
 
GET   	   /api/v1/auth/me	           Get current user

GET	       /api/v1/auth/logout	       Logout user

# 🧍 Users

Method	    Endpoint	                     Description

GET	        /api/v1/users/me	             Get user profile

PUT	        /api/v1/users/me	             Update user profile

PUT       	/api/v1/users/updatepassword	 Change password

DELETE	    /api/v1/users/me	             Delete user account

# 🧕 Addresses

Method	    Endpoint	                        Description

GET	        /api/v1/addresses	                Get all addresses

GET	        /api/v1/addresses/count	          Get address count

POST	      /api/v1/addresses	                Add address

PUT       	/api/v1/addresses/:id	            Update address

PUT	        /api/v1/addresses/:id/set-default	Set default address

DELETE    	/api/v1/addresses/:id	            Delete address

# 👕 Products

Method	   Endpoint	                                      Description

GET	       /api/v1/products	                              List all products

GET	       /api/v1/products/:id	                          Get single product

GET	       /api/v1/products/search	                      Search products

GET	       /api/v1/products/search/filters	              Filtered product search

POST      /api/v1/products/:id/reviews	                  Add review

GET	       /api/v1/products/:id/reviews	                  Get product reviews

PUT	       /api/v1/products/:productId/reviews/:reviewId	Update review

DELETE     /api/v1/products/:productId/reviews/:reviewId	Delete review

POST	     /api/v1/products/compare	                      Compare two products


# 🛒 Cart

Method	 Endpoint	             Description 

GET	     /api/v1/cart	         Get user cart

POST	   /api/v1/cart	         Add to cart

PUT	     /api/v1/cart/:itemId  Update cart item

DELETE	 /api/v1/cart/:itemId	 Remove cart item

DELETE	 /api/v1/cart	         Clear cart

# ❤️ Wishlist

Method	Endpoint	                            Description

GET	    /api/v1/wishlist	                    Get wishlist

POST	  /api/v1/wishlist	                    Add to wishlist

DELETE	/api/v1/wishlist/:itemId	            Remove from wishlist

POST   	/api/v1/wishlist/:itemId/move-to-cart	Move item to cart


# 📦 Orders

Method	Endpoint	                       Description

POST	  /api/v1/orders	                 Create order
 
GET	    /api/v1/orders/myorders        	 User orders

GET   	/api/v1/orders/:id	             Get single order

DELETE	/api/v1/orders/:id	             Cancel order

PUT	    /api/v1/orders/:id/deliver	     Mark as delivered (admin)

GET	    /api/v1/orders/:id/pdf	         Get PDF invoice

GET   	/api/v1/orders/:id/tracking	     Track order

POST	  /api/v1/orders/webhook/shipping	 Shipping webhook

# 🛠 Admin Routes

# 👥 Users
Method	Endpoint	                    Description

GET	    /api/v1/admin/users	          Get all users

GET	    /api/v1/admin/users/:id	      Get user details

POST  	/api/v1/admin/users	          Create new user

PUT	    /api/v1/admin/users/:id       Update user

DELETE	/api/v1/admin/users/:id	      Delete user

GET   	/api/v1/admin/users-list/pdf	Export users to PDF

# 🛍 Products

Method	Endpoint	                                         Description

GET   	/api/v1/admin/products	                           Admin: all products

POST	  /api/v1/admin/products	                           Add new product

PUT	    /api/v1/admin/products/:id	                       Update product

DELETE	/api/v1/admin/products/:id	                       Delete product

DELETE	/api/v1/admin/products/:productId/reviews/:reviewId	 Delete review

GET   	/api/v1/admin/products-list/pdf	                  Export product list PDF

# 📋 Orders

Method	Endpoint	                              Description

GET   	/api/v1/admin/orders	                  Admin: all orders

GET	    /api/v1/admin/orders/:id              	Get single order

PUT   	/api/v1/admin/orders/:id               	Update order

DELETE	/api/v1/admin/orders/:id              	Delete order

GET	    /api/v1/admin/orders-list/pdf           Export order list to PDF

GET	    /api/v1/admin/sales-report/pdf	        Get total sales report

GET	    /api/v1/admin/sales-report/category/pdf	Sales by category PDF

# 📊 Dashboard

Method	Endpoint	                      Description 

GET	    /api/v1/admin/dashboard-stats	  Get dashboard stats

# 📦 Project Setup
Prerequisites

Node.js and npm

MongoDB instance (local or Atlas)

.env file with environment variables (e.g., DB URI, JWT secret, email credentials)

Installation

git clone https://github.com/Biniljacobpro/ecommerce-boys-clothing.git

npm install

npm run dev

# 📁 Dependencies
Key dependencies used in the project:

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

# 📸 Features Overview

✅ JWT Authentication
✅ Full User Management
✅ Admin Panel with Dashboard
✅ Product Listing, Review, and Comparison
✅ Cart & Wishlist
✅ Address Management
✅ Orders with PDF Invoice
✅ Email Notification System
✅ Sales Report with Charts in PDF*


# 👨‍💻 Developer
Name    : Binil Jacob
Email   : biniljacob274@gmail.com
GitHub  : github.com/Biniljacobpro