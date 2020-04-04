const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cloudinary = require('cloudinary').v2;
const PORT = process.env.PORT || 3000;

const app = express();


app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
}); 
const { mongoose } = require('./config/mongoose');
const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

app.use(helmet());
app.use(compression());

app.use(bodyParser.urlencoded({ extended: false }));

app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.use(errorController.get404);

app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

// Clean up server when process exits
process.on('exit', (code) => {
  mongoose.disconnect();
  console.log('PROCESS IS EXITING WITH CODE ' + code);
});

// Handle server clean up in the event  of CTRL-C exit
process.on('SIGINT', (code) => {
  console.log('Ctrl-C was hit by server admin. EXITING WITH CODE ' + code);
  mongoose.disconnect();
  process.exit(2)
});

// Handle server clean up for uncaught errors
process.on('uncaughtException', (err) => {
  console.log(err.stack);
  mongoose.disconnect();
  process.exit(99)
});
app.listen(PORT, () => {
  console.log(`listening on ${PORT}`)
});
