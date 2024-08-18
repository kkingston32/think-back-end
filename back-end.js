const express = require("express");
const cors = require("cors");
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const { DAL } = require('./dal/mongo-dal');

const port = 8080;
const secret_key = 'Iliketoeatapplesandbananas';

// const origin = "http://localhost:3000"
// const origin = "https://thinkwellness.azurewebsites.net"

// Middleware setup
app.use(cors({ origin: 'https://thinkwellness.azurewebsites.net', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('./public'));
app.use('/public', express.static(path.join(__dirname, 'public')));
// app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: secret_key,
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const profilePicStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        let userId = req.cookies.userId; // Access userId from the cookies

        if (!userId) {
            return cb(new Error('User ID not found in cookies'), false);
        }

        const userDir = path.join(__dirname, 'public/images/profilePic', userId);
        // Create user directory if it doesn't exist
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();

        cb(null, `${timestamp}${path.extname(file.originalname)}`);
    }
});

const profilePicUpload = multer({
    storage: profilePicStorage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only .jpeg, .jpg and .png files are allowed!'));
        }
    }
}).single('image');

const postStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        let userId = req.cookies.userId; // Access userId from the cookies

        if (!userId) {
            return cb(new Error('User ID not found in cookies'), false);
        }

        const userDir = path.join(__dirname, 'public/images/posts', userId);
        // Create user directory if it doesn't exist
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        cb(null, userDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        cb(null, `${timestamp}${path.extname(file.originalname)}`);
    }
});

const uploadPic = multer({
    storage: postStorage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only .jpeg, .jpg and .png files are allowed!'));
        }
    }
}).single('image');

app.post('/uploadPic', (req, res) => {
    let userId = req.params.userId;
    const folderPath = path.join(__dirname, `public/images/${userId}`);

    try {
        // Read all files in the directory
        const files = fs.readdirSync(folderPath);

        // Iterate through each file and delete it
        files.forEach(file => {
            const filePath = path.join(folderPath, file);
            fs.unlinkSync(filePath);
        });
    } catch (err) {
        console.error('Error deleting files:', err);
    }

    uploadPic(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(500).json({ message: err.message });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (req.file == undefined || req.file == null) {
            res.json({ message: "Cannot upload image, please try again." });
        } else {
            DAL.uploadImg(userId, req.file.path);

            res.status(200).json({ message: "File is uploaded", userId: userId, filePath: req.file.path });
        }
    });
});

app.post('/uploadProfilePic/:userId', (req, res) => {
    let userId = req.params.userId;
    const folderPath = path.join(__dirname, `public/images/${userId}`);

    try {
        if (fs.existsSync(folderPath)) {
            // Read all files in the directory
            const files = fs.readdirSync(folderPath);

            // Iterate through each file and delete it
            files.forEach(file => {
                const filePath = path.join(folderPath, file);
                fs.unlinkSync(filePath);
            });
        } else {
            fs.mkdirSync(folderPath);
        }
    } catch (err) {
        console.error('Error deleting files:', err);
    }

    profilePicUpload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(500).json({ message: err.message });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (!req.file) {
            res.status(400).json({ message: "Cannot upload image, please try again." });
        } else {
            DAL.uploadProfileImg(userId, req.file.path)
                .then(() => {
                    res.status(200).json({ message: "File is uploaded", userId: userId, filePath: req.file.path });
                })
                .catch(err => {
                    console.error('Error in uploadProfileImg:', err);
                    res.status(500).json({ message: "Internal Server Error" });
                });
        }
    });
});


app.post('/newPost', uploadPic, async (req, res) => {
    let data = req.body;
    let posterUserId = req.cookies.userId;
    let feedUserId = req.params.userId;

    console.log("New Post Data: ", data)

    if (posterUserId == null || posterUserId == 'undefined') {
        res.json({ message: "Please login to access your profile" });
    } else {
        let post = {
            posterUserId: posterUserId,
            feedUserId: data.feedUserId,
            content: data.content,
            date: data.date,
            imageUrl: req.file ? `public/images/posts/${posterUserId}/${req.file.filename}` : null,
        };


        let newPost = await DAL.createPost(post);

        res.json(newPost);
    }
});

app.get('/getCookies', (req, res) => {
    res.json({ cookies: req.cookies });
});

app.get('/', (req, res) => {
    res.send("You hit my '/' route! Try our other routes (/login, /register)");
});

app.post('/login', async (req, res) => {
    let data = req.body;

    let existingUser = await DAL.getUserByEmail(data.email);
    if (existingUser) {
        const isMatch = await bcrypt.compare(data.password, existingUser.password);
        if (isMatch) {
            res.cookie('userId', existingUser._id.toString(), { httpOnly: true, secure: false, sameSite: 'lax' });
            res.json(existingUser);
        } else {
            res.json({ message: "Invalid login, try again." });
        }
    } else {
        res.json({ existingUser: false });
    }
});

app.post('/register', async (req, res) => {
    let data = req.body;
    const hashedPassword = await bcrypt.hash(data.password, 10);

    let existingUser = await DAL.getUserByEmail(data.email);
    if (existingUser) {
        res.json({
            message: "User already exists, please login.",
            alreadyExisted: true,
            userId: existingUser._id
        });
    } else {
        let user = {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            location: data.location,
            password: hashedPassword,
            exerciseType: [],
            workoutEnvironment: [],
            intensityLevel: [],
            duration: [],
            timeOfDay: [],
            goals: [],
            following: [],
            followers: [],
            alreadyExisted: false
        };

        let createResult = await DAL.createUser(user);
        let userId = createResult.insertedId.toString();
        let newUser = await DAL.getUserById(userId);

        // Set the cookie here
        res.cookie('userId', newUser._id.toString(), { httpOnly: true, secure: false, sameSite: 'lax' });

        res.json({
            userId: userId,
            newUser: newUser
        });
    }
});


app.get('/userprofile/:userId', async (req, res) => {
    let userId = req.cookies.userId;

    if (userId == null || userId == 'undefined') {
        res.json({ message: "Please login to access your profile" });
    } else {
        let user = await DAL.getUserById(userId);
        let followDetails = await DAL.getUserFollowDetails(userId);

        let data = {
            user: user,
            followDetails: followDetails,
        };
    
        res.json(data);
    }
});

app.get('/profile/:profileUserId', async (req, res) => {
    let profileUserId = req.params.profileUserId;

    let user = await DAL.getUserById(profileUserId);
    let followDetails = await DAL.getUserFollowDetails(profileUserId);

    let data = {
        user: user,
        followDetails: followDetails,
    };

    res.json(data);
});

app.delete('/deletePost', async (req, res) => {
    // if a user's ID matches either of the ID's on the post they may delete it. 
});

app.get('/posts/:feedUserId', async (req, res) => {
    try {
        const feedUserId = req.params.feedUserId;
        const posts = await DAL.getPostsForFeedUser(feedUserId);
        res.json(posts);
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/update/:userId', async (req, res) => {
    let userId = req.params.userId;

    if (userId == null || userId == 'undefined') {
        res.json({ message: "Please login to access your profile" });
    } else {
        let user = await DAL.getUserById(userId);
        console.log("User: ", user)
        res.json(user);
    }
});

app.put('/update/:userId', async (req, res) => {
    let userId = req.params.userId;
    let data = req.body;
    console.log("Update userID: ", userId)

    await DAL.updateUserInfo(data, userId);
    res.json({ message: "Successful Update" });
});

app.get('/followdetails/:userId', async (req, res) => {
    const userId = req.params.userId;

    try {
        const followDetails = await DAL.getUserFollowDetails(userId);
        res.status(200).json(followDetails);
    } catch (error) {
        console.error("Error fetching follow details:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/page/:pageInfo', async (req, res) => {
    const type = req.params.pageInfo;

    try {
        const pageDetails = await DAL.getWorkoutDetails(type);
        res.json(pageDetails);
    } catch (error) {
        console.error("Error fetching workout details:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.put('/follow/:profileUserId', async (req, res) => {
    let profileUserId = req.params.profileUserId;
    let userId = req.cookies.userId;

    console.log('profileUserId:', profileUserId); // Log profileUserId
    console.log('userId:', userId); // Log userId

    try {
        const isFollowing = await DAL.isFollowing(profileUserId, userId);
        if (isFollowing) {
            return res.status(400).json({ message: "Already following this user" });
        } else {
            await DAL.follow(profileUserId, userId);
            res.json({ message: "Follow Successful" });
        }
    } catch (error) {
        console.error('Error following user:', error);
        res.status(500).json({ message: "An error occurred" });
    }
});



app.put('/unfollow/:userId', (req, res) => {
    // Unfollow logic
});

app.get('/suggestions/:profileUserId', async (req, res) => {
    const profileUserId = req.params.profileUserId;

    try {
        const suggestedUsers = await DAL.getNetworkSuggestions(profileUserId);
        res.json(suggestedUsers);
    } catch (error) {
        console.error("Error fetching network suggestions:", error);
        res.status(500).json({ error: "An error occurred while fetching network suggestions." });
    }
});

app.get('/usergoals/:userId', (req, res) => {
    const user = users.find(user => user.id === req.params.userId);
    if (user) {
        res.json({ goals: user.goals, streaks: user.streaks });
    } else {
        res.status(404).send('User not found');
    }
});

app.post('/updateGoalProgress/:userId', (req, res) => {
    const user = users.find(user => user.id === req.params.userId);
    if (user) {
        const goal = user.goals.find(goal => goal.id === req.body.goalId);
        if (goal) {
            goal.progress += req.body.increment;
            user.streaks[req.body.goalId] = (user.streaks[req.body.goalId] || 0) + 1;
            res.json({ goals: user.goals, streaks: user.streaks });
        } else {
            res.status(404).send('Goal not found');
        }
    } else {
        res.status(404).send('User not found');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.send('Could not log out');
        } else {
            res.clearCookie('connect.sid');
            res.clearCookie('userId');
            res.json({ success: true });
        }
    });
});

app.get('/search', async (req, res) => {
    const name = req.query.name;

    try {
        const searchResults = await DAL.searchByName(name);
        res.json(searchResults);
    } catch (error) {
        console.error("Error fetching workout details:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(port, (err) => {
    if (err) console.log(err);
    console.log('Express listening on ', port);
});
