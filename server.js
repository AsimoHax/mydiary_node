const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jwt-simple');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./src/db');
require('dotenv').config()

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY; // Store this securely
const REFRESH_KEY = process.env.REFRESH_KEY;

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use(bodyParser.json());

//
const fontsize=14;
const font='Arial';
const background= '/uploads/background-1.avif';

// Register Route
app.post('/register', async (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({message: 'Missing required fields'});
    }
    try{
    db.query('SELECT * from users where name=?',[username], async (err, result) => {
        if (err) {
            return res.status(500).json({message: `Database error ${err.message}`});
        }

        if (result.length>0){
            return res.status(400).json({message: `Username already exists`});
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        db.query('INSERT INTO users (gmail, password, name, datecreated, background, fontsize, font) VALUES (?, ?, ?, NOW(), ?, ?, ?)',
            [email, hashedPassword, username, background, fontsize, font],
            (err, results) => {
                if (err) {
                    return res.status(500).json({message: `Failed to register user + ${err.message}`});
                }

            });
        db.query('select * from users where name=?',[username], async (err, result) => {
            console.log(result);
            const uid=result[0].uid;
            db.query('INSERT INTO collections(cname, datecreated, owneruid) values(?,now(),?)',['Uncategorized', uid], async (err, result) => {
                res.status(200).json({message: 'User registered successfully'});
            });

        })

    })}
    catch(err){
        console.log(err.message);
        res.status(500).json({message: `Failed to register user: ${err.message}`});
    }
});

// Login Route
app.post('/login', async (req, res) => {
    const { email, pass } = req.body;

    if (!email || !pass) {
        return res.status(400).json({message: 'Missing required fields'});
    }
    // Find user
    try{
        db.query('SELECT * from users where name=? or gmail=?',[email,email], async (err, result) => {
                if (err) {
                    return res.status(500).json({message: `Database error ${err.message}`});
                }

                if (result.length === 0) {
                    return res.status(400).json({message: `Invalid username or password`});
                }
                const user = result[0];
                bcrypt.compare(pass, user.password, (err, result) => {
                    if (err) {
                        return res.status(500).json({message: `Failed to login: ${err.message}`});
                    }

                    if (result.length===0) {
                        return res.status(400).json({message: `Invalid username or password`});
                    }

                    const accessToken = jwt.encode(user.uid, SECRET_KEY);
                    const refreshToken = jwt.encode(user.uid, REFRESH_KEY);

                    res.json({accessToken, refreshToken});

                });
            }
        )
    }   catch(err){
        res.status(500).json({message: `Failed to login user: ${err.message}`});
    }
});

// Protected Route (Example)
app.get('/protected', (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.decode(token, SECRET_KEY);
        const type= req.query.target;
        if (!type) {
            return res.status(403).json({ message: 'No request specified' });
        }
        if (type==='home'){
        try {
            db.query('SELECT * from users where uid=?',[decoded], async(err, result) => {
                if (err) {
                    return res.status(500).json({message: `Database error: ${err.message}`});
                }
                if (result.length===0) {
                    return res.status(500).json({message: `This user does not exists`});
                }
                const user = result[0];
                const data = {};
                data.name=user.name;
                data.uid=user.uid;
                data.gmail=user.gmail;
                db.query('select * from collections where owneruid=?',[user.uid], async(err, result2) => {
                    if (err) {
                        return res.status(500).json({message: `Database error ${err.message}`});
                    }
                    if (!result2) {
                        return res.json({message: `Empty`});
                    }
                    data.collections=result2;
                    db.query('SELECT e.eid, e.name, e.cid, c.cname, e.datecreated, e.lastedited FROM Entries e JOIN Collections c ON e.cid = c.cid ' +
                        'WHERE c.owneruid = ?;',[user.uid], async(err, result3) => {
                        if (err) {
                            return res.status(500).json({message: `Database error ${err.message}`});
                        }
                        if (!result3) {
                            return res.status(200).json({message: `Empty`});
                        }
                        data.mess=result3;
                        return res.status(200).json({data});
                    });
                })

            })
        } catch (err){
            console.log(err.message);
        }}
        else if (type==='view'){
            try{
                db.query('select c.cid, c.cname, c.owneruid from collections c join entries e on e.cid=c.cid where e.eid=?',[req.query.eid], async(err, result) => {
                    if (err) {
                        return res.status(500).json({message: `Database error ${err.message}`});
                    }
                    if (result.length === 0) {
                        return res.status(500).json({message: `Unauthorized`});
                    }
                    const data={};
                    data.name=result[0].cname;

                    db.query('SELECT * from entries where cid=?',[result[0].cid], async(err, result2) => {
                        if (err) {
                            return res.status(500).json({message: `Database error ${err.message}`});
                        }
                        if (!result2) {
                            return res.status(404).json({message: `Not found`});
                        }
                        data.entries=result2;
                        return res.status(200).json({data});
                    })

                })
            } catch (err){
                console.log(err.message);
            }
        }
        else if (type==='createEntry'){
            try{
                const {name, cid, categorized, username, uid, isEntry} = req.query;
                    if (isEntry==='false') {
                        db.query('select * from collections where cname=?',[name], async(err, result) => {
                            if (err) {
                                return res.status(500).json({message: `Database error ${err.message}`});
                            }
                            if (result.length>0) {
                                return res.status(400).json({message:'A collection with the same name already exists'});
                            }
                            db.query('insert into collections(cname, datecreated, owneruid) values(?,now(),?)',[name,uid], async(err, result) => {
                                if (err) {
                                    return res.status(500).json({message: `Database error ${err.message}`});
                                }
                                return res.status(200).json({message: `Success!`});
                            })
                        })
                    }
                    else {
                        if (categorized==='true'){
                        db.query('select * from entries e join collections c on c.cid=e.eid where e.name=? and c.owneruid=?',[name, uid] , async(err, result) => {
                            if (err) {
                                return res.status(500).json({message: `Database error ${err.message}`});
                            }
                            if (result.length > 0) {
                                return res.status(400).json({message: `An entry with the same name already exists`});
                            }

                            db.query('INSERT INTO ENTRIES(cid, name, datecreated, lastedited, content) VALUES(?, ?, now(), now(), ?)', [cid, name, ''], async (err, result2) => {
                                if (err) {
                                    return res.status(500).json({message: `Database error ${err.message}`});
                                }
                                if (!result2) {
                                    return res.status(404).json({message: `Not found`});
                                }
                                return res.status(200).json({message: `Successfully created entry`});
                            })
                        });
                        }
                        else {
                        db.query('select * from entries e join collections c on e.cid=c.cid where e.name=? and c.owneruid=?',[name, uid], async(err, result) => {
                            if (err) {
                                return res.status(500).json({message: `Database error g ${err.message}`});
                            }
                            if (result.length > 0) {

                                return res.status(400).json({message: `An entry with the same name already exists`});
                            }
                            let cid=0;
                                db.query('select * from collections where cname=? and owneruid=?',['Uncategorized', uid], async(err, result) => {

                                    if (result.length>0){
                                        cid=result[0].cid;
                                            db.query('INSERT INTO ENTRIES(cid, name, datecreated, lastedited, content) VALUES(?, ?, now(), now(), ?)', [cid, name, ''], async (err, result2) => {

                                                if (err) {
                                                    return res.status(500).json({message: `Database error w ${err.message}`});
                                                }
                                                if (!result2) {
                                                    return res.status(404).json({message: `Not found`});
                                                }
                                                return res.status(200).json({message: 'Successfully created entry'});
                                            });
                                    } else {
                                        db.query('INSERT INTO collections(cname, datecreated, owneruid) values(?,now(),?)', ['Uncategorized', uid], async(err, result) => {

                                            if (err) {
                                                return res.status(500).json({message: `Database failure + ${err.message}`});
                                            }
                                            db.query('select * from collections where owneruid=? and cname=?',[uid,'Uncategorized'], async(err, result) => {
                                                const cid = result[0].cid;
                                                db.query('INSERT INTO ENTRIES(cid, name, datecreated, lastedited, content) VALUES(?, ?, now(), now(), ?)', [cid, name, ''], async (err, result2) => {

                                                    if (err) {
                                                        return res.status(500).json({message: `Database error w ${err.message}`});
                                                    }
                                                    if (!result2) {
                                                        return res.status(404).json({message: `Not found`});
                                                    }
                                                    return res.status(200).json({message: 'Successfully created entry'});
                                                });
                                            });
                                        });
                                    }

                                });

                        });
                    }
                    }
            } catch (err){
                console.log(err.message);
            }
        }
        else if (type==='delete'){
            try{

                db.query('select c.cid, c.cname, c.owneruid from collections c join entries e on e.cid=c.cid where e.eid=?',[req.query.eid], async(err, result) => {
                    if (err) {
                        return res.status(500).json({message: `Database error ${err.message}`});
                    }
                    if (result.length === 0) {
                        return res.status(401).json({message: `Unauthorized`});
                    }
                    const data={};
                    data.name=result[0].cname;

                    db.query('SELECT * from entries where cid=?',[result[0].cid], async(err, result2) => {
                        if (err) {
                            return res.status(500).json({message: `Database error ${err.message}`});
                        }
                        if (!result2) {
                            return res.status(404).json({message: `Not found`});
                        }
                        data.entries=result2;
                        return res.status(200).json({data});
                    })

                })
            } catch (err){
                console.log(err.message);
            }
        }

    } catch (err) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
});

// Refresh token route
app.post('/refresh-token', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(403).send('Refresh token required');
    }

    try {
        const decoded = jwt.decode(refreshToken, REFRESH_KEY);
        const accessToken = jwt.encode(decoded, SECRET_KEY);
        const newRefreshToken = jwt.encode(decoded, REFRESH_KEY);

        // Send new tokens in the response
        res.json({ accessToken, refreshToken: newRefreshToken });
    } catch (err) {
        res.status(401).json({ message: 'Invalid or expired token' });
    }}
    );

app.post('/save', (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.decode(token, SECRET_KEY);
        const {val,eid} = req.body.content;
        db.query('update entries set content=?, lastedited=now() where eid=?',[JSON.stringify(val), eid],async(err, result) => {
            if (err) {
                console.log(JSON.stringify(val));
                return res.status(500).json({message: `Database error ${err.message}`});
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Content not found' });
            }
            return res.status(200).json({message: 'Successfully updated content'});
        })
    }
    catch (err) {
        console.log('www');
        return res.status(401).json({ message: 'Invalid or expired token' });

    }
})

app.use((err, req, res, next) => {
    console.error(err.stack);  // Log the error details
    res.status(500).send('Something went wrong!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
