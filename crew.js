const {MongoClient} = require('MongoDB')
let crewList = [];
let positions = [];
let grades = [];
const aircraftType = 'A380_3class_noULR';

async function main(){
    const uri='mongodb+srv://mongoUser:zxc123@cluster0.whd1q.mongodb.net/crew?retryWrites=true&w=majority'
    const client = new MongoClient(uri, {useNewUrlParser: true, useUnifiedTopology: true})
    try {
        await client.connect()
        await loadPositions(client, aircraftType)
        await loadCrew (client)
        checkPreallocatedPositions(crewList)
        grades.forEach(crew => allocateCrewPositions(crew));
        await updatePosition(client, crewList)
    }
    catch (e){
        console.error(e)
    }
    finally{
        await client.close()
    }
}
main().catch(console.error)

async function loadPositions (client, aircraftType){
    positions = await client.db("crew").collection('positions')
    .find(
        {'aircraftType':aircraftType},
        {projection:{'_id':0, 'aircraftType':0}}
        ).toArray()
    positions = positions[0].positions
    grades = Object.keys(positions);
    // await client.db("crew").collection("crew_back_up").find().forEach(
    //     function(docs){
    //          client.db("crew").collection("crew").insert(docs);
    //     })
    // await client.db('crew').collection('crewTest').drop()
}
async function loadCrew (client){
    crewList = await client.db("crew").collection("crew").find({},{projection:{'_id':0}}).toArray()
    crewList.forEach(item => {if(item.dfRating==''){item.dfRating=21}})
}
const checkPreallocatedPositions = (crewList) => {
    let preallocatedPositions = [];
    crewList.forEach(element => {
        if(element.position !== ''){preallocatedPositions.push(element.position)}
    })
    preallocatedPositions.forEach(item => {
        for (let grade of Object.values(positions)) {
            for (let type of Object.values(grade)) {
                if (type.indexOf(item) !== -1) { type.splice(type.indexOf(item), 1) }
            }
        }
    })
}
const allocateCrewPositions = (grade) =>{
    if (positions[grade].df && positions[grade].df.length > 0) {
        let gradeCrew = crewList.filter(crew => crew.grade === grade && crew.position === "");
        gradeCrew.sort((a, b) => a.dfRating - b.dfRating);
        if (gradeCrew[0].dfRating <= 20) {
            positions[grade].df.forEach(item => {
                writePosition(crewList.indexOf(gradeCrew[0]), item);
                gradeCrew.shift();
            })
        }
        else {
            positions[grade].df.forEach(item => {
                gradeCrew = crewList.filter(crew => crew.grade === grade && crew.position === "" && crew.lastPosition.includes(item) === false);
                n = getRandomNumber(0, gradeCrew.length);
                writePosition(crewList.indexOf(gradeCrew[n]), item);
            })
        }
    }
    if (positions[grade].galley && positions[grade].galley.length > 0) {
        positions[grade].galley.forEach(item => {
            let gradeCrew = crewList.filter(crew => crew.grade === grade && crew.position === "" && crew.lastPosition.includes(item) == false && crew.timeInGrade > 6);
            if (gradeCrew.length == 0) {
                gradeCrew = crewList.filter(crew => crew.grade === grade && crew.position === "" && crew.timeInGrade > 6);
            }
            if (gradeCrew.length == 0) {
                gradeCrew = crewList.filter(crew => crew.grade === grade && crew.position === "");
            }
            n = getRandomNumber(0, gradeCrew.length);
            writePosition(crewList.indexOf(gradeCrew[n]), item);
        });
    }
    if (positions[grade].remain && positions[grade].remain.length > 0) {
        positions[grade].remain.forEach(item => {
            let gradeCrew = crewList.filter(crew => crew.grade === grade && crew.position === "" && crew.lastPosition.includes(item) === false);
            if (gradeCrew.length == 0) {
                gradeCrew = crewList.filter(crew => crew.grade === grade && crew.position === "");
            }
            n = getRandomNumber(0, gradeCrew.length);
            writePosition(crewList.indexOf(gradeCrew[n]), item);
        });
    }
};
let writePosition = (crewIndex, position) => {
    crewList[crewIndex].position = position;
    crewList[crewIndex].lastPosition.unshift(position);
    crewList[crewIndex].lastPosition.pop();
}
async function updatePosition (client, crewList){
    for (i=0; i<crewList.length; i++){await client.db("crew").collection("crew")
        .updateOne(
            {name: crewList[i].name},
            {$push: {previous: crewList[i].position}, $set: {lastPosition: crewList[i].lastPosition}}
        )
    }
}
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min)) + min;