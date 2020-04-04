const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator');

const PDFDocument = require('pdfkit');
//const stripe = require('stripe')(process.env.STRIPE_KEY);

const Product = require('../models/product');
const Order = require('../models/order');

const ITEMS_PER_PAGE = 2;

exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then(numProducts => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then(products => {
      res.status(200).json({
        message: 'Fetched products',
        products: products,
        totalItems: totalItems
      });
    })
    .catch(err => {
      if (!err.statusCode) {
        const error = new Error(err);
        error.statusCode = 500;
      }
      next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.status(200).json({
        product: product,
      });
    })
    .catch(err => {
      if (!err.statusCode) {
        const error = new Error(err);
        error.statusCode = 500;
      }
      next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
       res.status(200).json({
        products: products,
      });
    })
    .catch(err => {
      if (!err.statusCode) {
      const error = new Error(err);
      error.statusCode = 500;
      }
       next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(result => {
      res.status(200).json({
        result: result
      });
    })
    .catch(err => {
   if (!err.statusCode) {
      const error = new Error(err);
      error.statusCode = 500;
      }
       next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(result => {
      res.status(200).json({
        result: result
      });
    })
    .catch(err => {
      if (!err.statusCode) {
        const error = new Error(err);
        error.statusCode = 500;
        }
         next(error);
    });
};

exports.getCheckout = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      let total = 0;
      products.forEach(p => {
        total += p.quantity * p.productId.price;
      });
      res.status(200).json({
        total: total,
        products: products
      });
    })
    .catch(err => {
      if (!err.statusCode) {
        const error = new Error(err);
        error.statusCode = 500;
        }
         next(error);
    });
};

// exports.postOrder = (req, res, next) => {
//   // Token is created using Checkout or Elements!
//   // Get the payment token ID submitted by the form:
//   const token = req.body.stripeToken; // Using Express
//   let totalSum = 0;

//   req.user
//     .populate('cart.items.productId')
//     .execPopulate()
//     .then(user => {  
//       user.cart.items.forEach(p => {
//         totalSum += p.quantity * p.productId.price;
//       });

//       const products = user.cart.items.map(i => {
//         return { quantity: i.quantity, product: { ...i.productId._doc } };
//       });
//       const order = new Order({
//         user: {
//           email: req.user.email,
//           userId: req.user
//         },
//         products: products
//       });
//       return order.save();
//     })
//     .then(result => {
//       const charge = stripe.charges.create({
//         amount: totalSum * 100,
//         currency: 'usd',
//         description: 'Demo Order',
//         source: token,
//         metadata: { order_id: result._id.toString() }
//       });
//       return req.user.clearCart();
//     })
//     .then(() => {
//       res.redirect('/orders');
//     })
//     .catch(err => {
//       const error = new Error(err);
//       error.statusCode = 500;
//       return next(error);
//     });
// };

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then(orders => {
      res.status(200).json({
        orders: orders
      });
    })
    .catch(err => {
      if (!err.statusCode) {
        const error = new Error(err);
        error.statusCode = 500;
        }
         next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then(order => {
      if (!order) {
        return next(new Error('No order found.'));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error('You are not authorized'));
      }
      const invoiceName = 'invoice-' + orderId + '.pdf';
      const invoicePath = path.join('data', 'invoices', invoiceName);

      const pdfDoc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="' + invoiceName + '"'
      );
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);

      pdfDoc.fontSize(26).text('Invoice', {
        underline: true
      });
      pdfDoc.text('-----------------------');
      let totalPrice = 0;
      order.products.forEach(prod => {
        totalPrice += prod.quantity * prod.product.price;
        pdfDoc
          .fontSize(14)
          .text(
            prod.product.title +
              ' - ' +
              prod.quantity +
              ' x ' +
              '$' +
              prod.product.price
          );
      });
      pdfDoc.text('---');
      pdfDoc.fontSize(20).text('Total Price: $' + totalPrice);

      pdfDoc.end();
    })
    .catch(err => next(err));
};
