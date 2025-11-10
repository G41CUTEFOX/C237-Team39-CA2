const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();
const path = require('path');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images'); // Make sure this folder exists
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    const unique = Date.now() + '_' + base + ext;
    cb(null, unique);
  }
});

const upload = multer({ storage: storage });

const fs = require('fs');

const connection = mysql.createConnection({
  host: '5fp4wj.h.filess.io',
  user: 'perfume_website_pagedetail', 
  password: '601f1d93ebab260e41c3f973e8031d50fd65b6d9',
  database: 'perfume_website_pagedetail',
  port: 3307,
ssl: {
  ca: fs.readFileSync(
    path.join(__dirname, 'public', 'BaltimoreCyberTrustRoot.crt.pem')
  ),
  rejectUnauthorized: false
}
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static(path.join(__dirname, 'public')));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));    
app.use(express.json());


//TO DO: Insert code for Session Middleware below 
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } 
}));

app.use(flash());

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        return res.redirect('/shopping');
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
        return res.status(400).send('All fields are required.');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Define routes
app.get('/',  (req, res) => {
    res.render('index', {user: req.session.user} );
});

app.get('/inventory', checkAuthenticated, checkAdmin, (req, res) => {
     const search = req.query.search || '';
    const searchTerm = '%' + search + '%';
    const query = 'SELECT * FROM fragrances WHERE fragranceName LIKE ?';

    connection.query(query, [searchTerm], (error, results) => {
        if (error) {
            console.error("Error loading inventory page:", error);
            return res.status(500).send("Error loading shopping page");
        }

        console.log("User session:", req.session.user);         
        console.log("Fragrance results:", results);             

        try {
            res.render('inventory', {
                user: req.session.user,
                fragrances: results,
                search: search
            });
        } catch (renderErr) {
            console.error("Render error:", renderErr);         
            res.status(500).send("Error rendering inventory page");
        }
    });
});

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

app.post('/register', validateRegistration, (req, res) => {

    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    connection.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    connection.query(sql, [email, password], (err, results) => {
        if (err) {
            console.error("Login DB error:", err);
            req.flash('error', 'Database error.');
            return res.redirect('/login');
        }

        if (results.length > 0) {
            req.session.user = results[0];

            console.log("Login success:", results[0]);  

            // Redirect based on role
            if (results[0].role === 'admin') {
                return res.redirect('/inventory');
            } else if (results[0].role === 'user') {
                return res.redirect('/shopping');
            } else {
                req.flash('error', 'Unknown role.');
                return res.redirect('/login');
            }
        } else {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }
    });
});

// Route for user shopping page
app.get('/shopping', checkAuthenticated, (req, res) => {
    const search = req.query.search || '';
    const searchTerm = '%' + search + '%';
    const query = 'SELECT * FROM fragrances WHERE fragranceName LIKE ?';

    connection.query(query, [searchTerm], (error, results) => {
        if (error) {
            console.error("Error loading shopping page:", error);
            return res.status(500).send("Error loading shopping page");
        }

        console.log("User session:", req.session.user);         
        console.log("Fragrance results:", results);             

        try {
            res.render('shopping', {
                user: req.session.user,
                fragrances: results,
                search: search
            });
        } catch (renderErr) {
            console.error("Render error:", renderErr);         
            res.status(500).send("Error rendering shopping page");
        }
    });
});



app.post('/add-to-cart/:id', checkAuthenticated, (req, res) => {
    const fragranceId = parseInt(req.params.id);
    const quantity = parseInt(req.body.quantity) || 1; 

    connection.query('SELECT * FROM fragrances WHERE fragranceId = ?', [fragranceId], (error, results) => {
        if (error) throw error;

        if (results.length > 0) {
            const fragrance = results[0];

            if (!req.session.cart) {
                req.session.cart = [];
            }

            const existingItem = req.session.cart.find(item => item.fragranceId === fragranceId);
            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                req.session.cart.push({
                    fragranceId: fragrance.fragranceId,
                    fragranceName: fragrance.fragranceName,
                    price: fragrance.price,
                    quantity: quantity, 
                    description: fragrance.description,
                    image: fragrance.image
                });
            }

            res.redirect('/cart');
        } else {
            res.status(404).send("Fragrance not found");
        }
    });
});

app.get('/cart', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    res.render('cart', { cart, user: req.session.user });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/fragrance/:id', checkAuthenticated, (req, res) => {
  // Extract the fragrance ID from the request parameters
  const fragranceId = req.params.id;

  // Fetch data from MySQL based on the fragrance ID
  connection.query('SELECT * FROM fragrances WHERE fragranceId = ?', [fragranceId], (error, results) => {
      if (error) throw error;

      // Check if any fragrance with the given ID was found
      if (results.length > 0) {
          // Render HTML page with the fragrance data
          res.render('fragrance', { fragrance: results[0], user: req.session.user  });
      } else {
          // If no fragrance with the given ID was found, render a 404 page or handle it accordingly
          res.status(404).send('Fragrance not found');
      }
  });
});

app.get('/addFragrance', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addFragrance', {user: req.session.user } ); 
});

app.post('/addFragrance', (req, res) => {
  const { name, quantity, price, description, imageUrl } = req.body;

  // Use the URL (trimmed) or null if empty
  const image = imageUrl.trim() !== '' ? imageUrl.trim() : null;

  const sql = `
    INSERT INTO fragrances 
      (fragranceName, quantity, price, description, image)
    VALUES (?, ?, ?, ?, ?)
  `;

  connection.query(
    sql, 
    [name, quantity, price, description, image],
    (error) => {
      if (error) {
        console.error("Error adding fragrance:", error);
        return res.status(500).send('Error adding fragrance');
      }
      res.redirect('/inventory');
    }
  );
});

app.get('/updateFragrance/:id',checkAuthenticated, checkAdmin, (req,res) => {
    const fragranceId = req.params.id;
    const sql = 'SELECT * FROM fragrances WHERE fragranceId = ?';

    // Fetch data from MySQL based on the fragrance ID
    connection.query(sql , [fragranceId], (error, results) => {
        if (error) throw error;

        // Check if any fragrance with the given ID was found
        if (results.length > 0) {
            // Render HTML page with the fragrance data
            res.render('updateFragrance', { fragrance: results[0] });
        } else {
            // If no fragrance with the given ID was found, render a 404 page or handle it accordingly
            res.status(404).send('Fragrance not found');
        }
    });
});

app.post('/updateFragrance/:id', (req, res) => {
    const fragranceId = req.params.id;
    const { name, quantity, price, description, imageUrl, currentImage } = req.body;

    // If imageUrl is provided, use it. Otherwise, use the existing image.
    const image = imageUrl && imageUrl.trim() !== '' ? imageUrl.trim() : currentImage;

    const sql = 'UPDATE fragrances SET fragranceName = ?, quantity = ?, price = ?, description = ?, image = ? WHERE fragranceId = ?';
    connection.query(sql, [name, quantity, price, description, image, fragranceId], (error, results) => {
        if (error) {
            console.error("Error updating fragrance:", error);
            return res.status(500).send('Error updating fragrance');
        }
        res.redirect('/inventory');
    });
});


app.post('/deleteFragrance/:id', checkAuthenticated, checkAdmin, (req, res) => {
  const fragranceId = req.params.id;
  connection.query('DELETE FROM fragrances WHERE fragranceId = ?', [fragranceId], (error, results) => {
    if (error) {
      console.error("Error deleting fragrance:", error);
      res.status(500).send('Error deleting fragrance');
    } else {
      res.redirect('/inventory');
    }
  });
});

app.get('/dashboard', checkAuthenticated, (req, res) => {
    const search = req.query.search || '';
    const query = 'SELECT * FROM fragrances WHERE fragranceName LIKE ?';
    const searchTerm = '%' + search + '%';

    connection.query(query, [searchTerm], (error, results) => {
        if (error) throw error;
        res.render('dashboard', { user: req.session.user, fragrances: results, search });
    });
});

app.post('/remove-from-cart/:id', (req, res) => {
  const fragranceIdToRemove = parseInt(req.params.id);

  if (req.session.cart) {
    req.session.cart = req.session.cart.filter(item => item.fragranceId !== fragranceIdToRemove);
  }

  res.redirect('/cart');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));
