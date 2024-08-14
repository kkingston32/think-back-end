
const { MongoClient, ObjectId } = require("mongodb")
const uri = "mongodb+srv://dev:dev@cluster0.brqqamr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
const client = new MongoClient(uri)
const db = 'think'
const usersCollection = 'users'
const postCollection = 'posts'
const pagesCollection = 'pages'








exports.DAL = {



    
searchByName: async function(name) {
        const client = new MongoClient(uri);
        try {
            await client.connect();
            const database = client.db(db);
            const theUsersCollection = database.collection(usersCollection);
            const thePagesCollection = database.collection(pagesCollection);

            // Query for users
            const userQuery = {
                $or: [
                    { firstName: { $regex: new RegExp(name, 'i') } },
                    { lastName: { $regex: new RegExp(name, 'i') } }
                ]
            };
            console.log("USER SEARCH QUERY: ", userQuery);
            const users = await theUsersCollection.find(userQuery).toArray();
            console.log("USER SEARCH RESULTS: ", users);

            // Query for pages
            const pageQuery = { Name: { $regex: new RegExp(name, 'i') } };
            console.log("PAGE SEARCH QUERY: ", pageQuery);
            const pages = await thePagesCollection.find(pageQuery).toArray();
            console.log("PAGE SEARCH RESULTS: ", pages);

            return {
                users,
                pages
            };
        } catch (error) {
            console.error("Error in searchByName:", error);
        } finally {
            await client.close();
        }
    },


    getWorkoutDetails: async function(type) {
        const client = new MongoClient(uri);
    
        try {
            const database = client.db(db);
            const thePageCollection = database.collection(pagesCollection);
    
            
            // Normalize the input type
            const normalizedType = type.toLowerCase().replace(/\s+/g, ' ').trim();
            console.log("normailizedType: ", normalizedType)
    
            // Create a case-insensitive regex query
            const query = {
                Name: {
                    $regex: new RegExp(`^${normalizedType}$`, 'i') // Case-insensitive match
                }
            };
    
            // console.log("MONGO QUERY: ", query);
    
            const page = await thePageCollection.findOne(query);
            // console.log()
            // console.log("MONGO PAGE DEETS: ", page);
    
            return page;
        } finally {
            await client.close();
        }
    },
    
    
    // insertWorkoutTypes: async () => {
    //     try {
    //         await client.connect();
    //         const database = client.db(db);
    //         const thePagesCollection = database.collection(pagesCollection);
    
    //         // Insert multiple documents into the Pages collection
    //         const result = await thePagesCollection.insertMany(workoutTypes);
    //         console.log(`${result.insertedCount} workout types were inserted.`);
    //     } catch (error) {
    //         console.error('Error inserting workout types:', error);
    //     } finally {
    //         await client.close();
    //     }
    // },

    getUserFollowDetails: async function (userId) {
        try {
            await client.connect();
            const database = client.db(db);
            const theUsersCollection = database.collection(usersCollection);
    
            const user = await theUsersCollection.findOne({ _id: ObjectId.createFromHexString(userId) });
            if (!user) {
                throw new Error(`User with ID ${userId} not found`);
            }
    
            const { followers = [], following = [] } = user;
    
            const followerDetails = await theUsersCollection.find({ _id: { $in: followers.map(id => new ObjectId(id)) } }).toArray();
            const followingDetails = await theUsersCollection.find({ _id: { $in: following.map(id => new ObjectId(id)) } }).toArray();
    
            console.log(followerDetails)


            

            const followersWithNames = followerDetails.map(follower => {
                if (follower.profileImgUrl) {
                    const followerRelativePath = follower.profileImgUrl.split('public')[1];
                    imgUrl = `http://localhost:3232/public${followerRelativePath}`;
                }
                return {
                    id: follower._id.toString(),
                    name: `${follower.firstName} ${follower.lastName}`,
                    imgUrl: imgUrl
                };
            });
            console.log("FOLLOWERSWITHNAMES: ", followersWithNames)
    
            const followingWithNames = followingDetails.map(following => {
                if (following.profileImgUrl) {
                    const followingRelativePath = following.profileImgUrl.split('public')[1];
                    imgUrl = `http://localhost:3232/public${followingRelativePath}`;
                }
                return {
                    id: following._id.toString(),
                    name: `${following.firstName} ${following.lastName}`,
                    imgUrl: imgUrl
                };
            });
    
            return {
                followers: followersWithNames,
                following: followingWithNames
            };
        } catch (error) {
            console.error("Error in getUserFollowDetails:", error);
        } finally {
            await client.close();
        }
    },

    isFollowing: async function (profileUserId, userId) {
        await client.connect();
        const database = client.db(db);
        const theUsersCollection = database.collection(usersCollection);
    
        const user = await theUsersCollection.findOne({ _id: userId, following: profileUserId });
        return !!user; // Return true if user is found, false otherwise
    },

    follow: async function (profileUserId, userId) {
        try {
            await client.connect();
            const database = client.db(db);
            const theUsersCollection = database.collection(usersCollection);
    
            const query1 = { _id: ObjectId.createFromHexString(userId) };
            const query2 = { _id: ObjectId.createFromHexString(profileUserId) };
    
            console.log("QUERY: ", query1, profileUserId, userId);
    
            // Ensure `following` is an array
            const user = await theUsersCollection.findOne(query1);
            if (user.following && typeof user.following === 'string') {
                await theUsersCollection.updateOne(query1, {
                    $set: { following: [user.following] }
                });
            } else if (!user.following) {
                await theUsersCollection.updateOne(query1, {
                    $set: { following: [] }
                });
            }
    
            // Ensure `followers` is an array
            const profileUser = await theUsersCollection.findOne(query2);
            if (profileUser.followers && typeof profileUser.followers === 'string') {
                await theUsersCollection.updateOne(query2, {
                    $set: { followers: [profileUser.followers] }
                });
            } else if (!profileUser.followers) {
                await theUsersCollection.updateOne(query2, {
                    $set: { followers: [] }
                });
            }
    
            const following = { $push: { following: profileUserId } };
            const followers = { $push: { followers: userId } };

    
            console.log("UPDATED DATA: ", following, followers);
    
            const result1 = await theUsersCollection.updateOne(query1, following);
            const result2 = await theUsersCollection.updateOne(query2, followers);
    
            const results = [result1, result2];
            return results;
        } catch (error) {
            console.error("Error in followUser:", error);
        } finally {
            await client.close();
        }
    },

    getPostsForFeedUser: async function (feedUserId) {
        const client = new MongoClient(uri);
        try {
            const database = client.db(db);
            const thePostCollection = database.collection(postCollection);
            const theUsersCollection = database.collection(usersCollection);

            const posts = await thePostCollection.find({ feedUserId: feedUserId }).toArray();
            console.log("DAL POSTS: ", feedUserId, posts)
            const posterUserIds = posts.map(post => post.posterUserId);
            const users = await theUsersCollection.find({ _id: { $in: posterUserIds.map(id => new ObjectId(id)) } }).toArray();

            const userMap = users.reduce((map, user) => {
                map[user._id.toString()] = `${user.firstName} ${user.lastName}`;
                return map;
            }, {});

            return posts.map(post => ({
                posterName: userMap[post.posterUserId] || 'Unknown',
                posterId: post.posterUserId,
                content: post.content,
                date: post.date,
                imageUrl: post.imageUrl
            }));
        } finally {
            await client.close();
        }
    },

    createPost: async function (post) {
        console.log('DAL Create Post: ', post)
        const client = new MongoClient(uri)
        try {
            const database = client.db(db)
            const thePostCollection = database.collection(postCollection)
            let newPost = {
                posterUserId: post.posterUserId,
                feedUserId: post.feedUserId,
                content: post.content,
                date: post.date,
                imageUrl: post.imageUrl,
            }
            const result = await thePostCollection.insertOne(newPost)

            return result
        } finally {
            await client.close()
        }
        console.log("Create post: ", result)
    },

    createUser: async function (data) {
        console.log('DAL Create User: ', data)
        const client = new MongoClient(uri)
        try {
            const database = client.db(db)
            const theUsersCollection = database.collection(usersCollection)
            let newUser = {
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                password: data.password,
                profileImgUrl: null,
                exerciseType: [],
                workoutEnvironment: [],
                intensityLevel: [],
                duration: [],
                timeOfDay: [],
                goals: [],
                following: [],
                followers: [],
            }
            const result = await theUsersCollection.insertOne(newUser)

            return result
        } finally {
            await client.close()
        }
        console.log("Create user: ", result)
    },

    uploadProfileImg: async function (id, data) {
        const client = new MongoClient(uri);
        try {
            console.log("upload: ", id, data);
            await client.connect();
            const database = client.db(db);
            const theUsersCollection = database.collection(usersCollection);
            const query = { _id: new ObjectId(id) };
            const updatedData = {
                $set: {
                    profileImgUrl: data
                }
            };
    
            const result = await theUsersCollection.updateOne(query, updatedData);
            return result;
        } finally {
            await client.close();
        }
    },

    uploadImg: async function (id, data) {
        try {
            console.log("upload: ", id, data)
            const client = new MongoClient(uri)
            const database = client.db(db)
            const theUsersCollection = database.collection(usersCollection)
            const query = { _id: ObjectId.createFromHexString(id) }
            const updatedData = {
                $set: {
                    ImgUrls: data
                }
            }

            const result = await theUsersCollection.updateOne(query, updatedData)
            return result
        } finally {
            await client.close()
        }

    },

    delete: async function (id) {
        console.log("Delete User with Id: ", id)
        try {
            const client = new MongoClient(uri)
            const database = client.db(db)
            const theUserCollection = database.collection(usersCollection)
            const query = { _id: ObjectId.createFromHexString(id) }
            const user = await theUserCollection.deleteOne(query)
            console.log(user)
            return user
        } finally {
            await client.close()
        }
    },

    getUserByEmail: async function (email) {
        const client = new MongoClient(uri)

        try {
            const database = client.db(db)
            const theUserCollection = database.collection(usersCollection)
            const query = { email: email }
            const user = await theUserCollection.findOne(query)

            return user
        } finally {
            await client.close()
        }
    },
    getUserById: async function (id) {
        const client = new MongoClient(uri)

        try {
            const database = client.db(db)
            const theUserCollection = database.collection(usersCollection)
            const query = { _id: ObjectId.createFromHexString(id) }
            const user = await theUserCollection.findOne(query)

            return user
        } finally {
            await client.close()
        }
    },
    updateUserInfo: async function (data, id) {
        try {
            console.log("UPDATE USER INFO DATA: ", data, id)
            const client = new MongoClient(uri)
            const database = client.db(db)
            const theUsersCollection = database.collection(usersCollection)
            const query = { _id: ObjectId.createFromHexString(id) }
            console.log("QUERY: ", query)
            const updatedData = {
                $set: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    location: data.location,
                    exerciseType: data.exerciseType,
                    workoutEnvironment: data.workoutEnvironment,
                    intensityLevel: data.intensityLevel,
                    duration: data.duration,
                    timeOfDay: data.timeOfDay,
                    goals: data.goals,
                    equipment: data.equipment
                }
            }
            console.log("UPATED DATA: ", updatedData)

            const result = await theUsersCollection.updateOne(query, updatedData)
            return result
        } finally {
            await client.close()
        }

    },

    uploadProfileImg: async function (id, data) {
        try {
            console.log("upload profile image: ", id, data);
            const client = new MongoClient(uri);
            await client.connect();
            const database = client.db(db);
            const theUsersCollection = database.collection(usersCollection);
            const query = { _id: ObjectId.createFromHexString(id) };
            const updatedData = {
                $set: {
                    profileImgUrl: data
                }
            };

            const result = await theUsersCollection.updateOne(query, updatedData);
            return result;
        } catch (error) {
            console.error("Error in uploadProfileImg:", error);
        } finally {
            await client.close();
        }
    },

    uploadPostImg: async function (postId, data) {
        try {
            console.log("upload post image: ", postId, data);
            const client = new MongoClient(uri);
            await client.connect();
            const database = client.db(db);
            const thePostCollection = database.collection(postCollection);
            const query = { _id: ObjectId.createFromHexString(postId) };
            const updatedData = {
                $set: {
                    imgUrl: data
                }
            };

            const result = await thePostCollection.updateOne(query, updatedData);
            return result;
        } catch (error) {
            console.error("Error in uploadPostImg:", error);
        } finally {
            await client.close();
        }
    },

    getNetworkSuggestions: async function (userId) {
        const client = new MongoClient(uri);
        try {
            await client.connect();
            const database = client.db(db);
            const theUsersCollection = database.collection(usersCollection);

            // Get the current user's profile
            const currentUser = await theUsersCollection.findOne({ _id: ObjectId.createFromHexString(userId) });
            if (!currentUser) {
                throw new Error(`User with ID ${userId} not found`);
            }

            const {
                exerciseType = [],
                goals = [],
                workoutEnvironment = [],
                intensityLevel = [],
                duration = [],
                timeOfDay = []
            } = currentUser;

            // Create a query to find users with similar preferences
            const query = {
                _id: { $ne: ObjectId.createFromHexString(userId) }, // Exclude the current user
                $or: [
                    { exerciseType: { $in: exerciseType } },
                    { goals: { $in: goals } },
                    { workoutEnvironment: { $in: workoutEnvironment } },
                    { intensityLevel: { $in: intensityLevel } },
                    { duration: { $in: duration } },
                    { timeOfDay: { $in: timeOfDay } }
                ]
            };

            // Execute the query and fetch matching users
            const suggestedUsers = await theUsersCollection.find(query).toArray();

            // Map the results to return only relevant information
            const suggestions = suggestedUsers.map(user => ({
                id: user._id.toString(),
                name: `${user.firstName} ${user.lastName}`,
                profileImgUrl: user.profileImgUrl,
                sharedPreferences: {
                    exerciseType: user.exerciseType.filter(type => exerciseType.includes(type)),
                    goals: user.goals.filter(goal => goals.includes(goal)),
                    workoutEnvironment: user.workoutEnvironment.filter(env => workoutEnvironment.includes(env)),
                    intensityLevel: user.intensityLevel.filter(level => intensityLevel.includes(level)),
                    duration: user.duration.filter(dur => duration.includes(dur)),
                    timeOfDay: user.timeOfDay.filter(time => timeOfDay.includes(time))
                }
            }));

            return suggestions;
        } catch (error) {
            console.error("Error in getNetworkSuggestions:", error);
        } finally {
            await client.close();
        }
    }
}





