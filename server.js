const express = require("express");
const cors = require('cors');
const helmet = require("helmet");
const morgan = require('morgan');
const rateLimit = require ('express-rate-limit');
require('dotenv').config();
const downloadRoute = require("./routes/download");



//Express App
const app = express();

//MIDDLEWARES
  app.use(express.json());          // Parse JSON requests
  app.use(cors());                  // enables cross-origin requests
  app.use(helmet());                // add security Headers
  app.use(morgan("dev"));           // Logging

const limiter = rateLimit({
  windowsMs: 1*60*1000,
  max:20,
  message : {
    status: 429,
    error: "Too many requests, try again later"
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limiter);

// Simple health check route
// app.get("/", (req, res) => {
//   res.send ( "Backend is running 🟢" );
// });

// app.get("/api/health", (req, res)=>{
//   res.status(200).json({
//     status:"ok",
//     message:"Backend is working on api/health as well",
//     timeStamp: new Date().toISOString()
//   });
// });

// app.post("/api/test" , (req, res) => {
//   console.log(req.body);
//   res.json({message: "Data Recieved", data:req.body})
// })

//Import resolve router
const resolveRouter = require ('./routes/resolve');

//Mount the resolveRouter
app.use('/api/resolve', resolveRouter);
app.use('api/download', downloadRoute);

// Start server
const PORT = process.env.PORT || 8082;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});