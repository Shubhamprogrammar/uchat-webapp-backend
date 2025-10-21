const express = require('express');
const process = require('process');
const cors = require("cors");
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/',(req,res)=>{
    res.send("U-Chat is running successfully");
})
app.listen(PORT,()=>{
    console.log(`U-Chat Web App is listening at port http://localhost:${PORT}`);
})