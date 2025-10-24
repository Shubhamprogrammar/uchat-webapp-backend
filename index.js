const express = require('express');
const process = require('process');
const cors = require("cors");
const dotenv = require('dotenv');
const path = require('path');
const connectToMongo = require('./models/config');

connectToMongo();
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', require('./routes/auth'));

const PORT = process.env.PORT || 5000;

app.get('/',(req,res)=>{
    res.send("U-Chat is running successfully");
})
app.listen(PORT,()=>{
    console.log(`U-Chat Web App is listening at port http://localhost:${PORT}`);
})