const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.apm2kiq.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const nodemailer = require('nodemailer');

// middlewires
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized Access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next()
    })
}


async function run() {
    try {
        await client.connect();
        const usersCollection = client.db('taskade-todoList').collection('users');
        const tasksCollection = client.db('taskade-todoList').collection('tasks');

        //store user info on db
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: user
            };
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1d'
            })
            res.send({ result, token });
        })
        //store users tasks on db
        app.post('/task', verifyJWT, async (req, res) => {
            const newTask = req.body;
            const result = await tasksCollection.insertOne(newTask);
            res.send(result);
        })
        //load all the tasks according user email
        app.get('/task/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email, archive: false };
            const result = await tasksCollection.find(query).toArray();
            res.send(result);

        })
        //load all the tasks according to archive state
        app.get('/archive/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email, archive: true };
            const result = await tasksCollection.find(query).toArray();
            res.send(result);

        })
        //move task to archive
        app.put('/task/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    archive: true
                }
            }
            const result = await tasksCollection.updateOne(filter, updatedDoc, options);
            res.send(result);

        })
        //mark task as done
        app.put('/task/mark/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const marked = req.body;
            // console.log(marked);
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    checked: marked.checked
                }
            }
            const result = await tasksCollection.updateOne(filter, updatedDoc, options);
            res.send(result);

        })
        //Edit task details
        app.put('/task/update/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const updatedTask = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    taskName: updatedTask.taskName,
                    taskDetails: updatedTask.taskDetails
                }
            };
            const result = await tasksCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        //receive email from user
        app.post('/email', verifyJWT, async (req, res) => {
            const user = req.body;
            const userEmail = user.userEmail;
            const userMessage = user.message;
            const userName = user.userName;
            //create a transporter
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_RECEIVER,
                    pass: process.env.EMAIL_PASSWORD
                }
            })
            //create the email
            const options = {
                from: userEmail,
                to: process.env.EMAIL_RECEIVER,
                subject: `tasKade new message from ${userName} ${userEmail}`,
                text: `${userMessage}`,
                html: `<div><p>${userMessage}</P></div>`
            };
            //send the email
            transporter.sendMail(options, function (err, info) {
                if (err) {
                    console.log(err);
                    res.send({message: 'failed'})
                }
                else {
                    console.log(info);
                    res.send({message: 'success'})
                }
            })
        })
    }
    finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})