'use strict';
const config = require('./env.json')[process.env.En];
//const apigClientFactory = require('aws-api-gateway-client').default;
const configProd = require('./env.json')["prod"];
const configQA = require('./env.json')["QA"];
const to = require('await-to-js').default;
const AWS = require('aws-sdk');
const sns = new AWS.SNS();
const s3= new AWS.S3();
const AWSTwo = require('aws-sdk');

var timefunc= require('./lib/timefunctions');
const AthenaExpress = require("athena-express");
var aidsaws= require('aws-sdk');
var prodOnly=require("aws-sdk");

aidsaws.config.update({
  accessKeyId: config.eqInfoKeyNew,
  secretAccessKey: config.eqSecretKeyNew,
  region: config.databaseRegion
});

/*
aidsaws.config.update({
  accessKeyId: configQA.eqInfoKeyNew,
  secretAccessKey: configQA.eqSecretKeyNew,
  region: configProd.databaseRegion
});
*/

const aidss3= new aidsaws.S3();

/*
aidsaws.config.update({
  accessKeyId: configQA.eqInfoKeyNew,
  secretAccessKey: configQA.eqSecretKeyNew,
  region: configProd.databaseRegion
});

const aidss3= new aidsaws.S3();

const athenaExpressConfig = {
	aws: aidsaws,
	db: "dispatches",
	getStats: true
};
const athenaExpress = new AthenaExpress (athenaExpressConfig);
//^this isnt my athena (aids)
*/
//^ this is ibt prod athena 

const methodCheckListEQ = 'GET';

//const pathTemplateEQ = configProd.pathTemplateEQ;
//const pathTemplateEQ = "/dev";
const bodyApi ={}
const bodyApiEQ ={};





 const methodCheckList = 'GET';
 const pathParams = {};
// const pathTemplateTK = `${config.pathTemplateEQ}/tk`;

 const cparams ={
   queryParams: {
      Action: "GetPacificInstant"
   }
 };

module.exports.hello = async (event, context, callback) => {
  
  let tableName = "LastInspectionInfo";
  let getParams = {};
  let putParams = {};
  console.log(event);
  let queryError;
  let queryResponse;
  const action = event.queryStringParameters.Action;
  console.log(action);
  let mirror;
  let b={};
  let updateObj={};
  if(!event.body){
    console.log("probalby empty?");
  }else{
    console.log("There is a body");
        console.log(event.body);
        mirror=JSON.parse(event.body);
        //b=mirror.payload;
        b=mirror;
        console.log(JSON.stringify(b));
        
        
  }
  let statusCode;
  let bodyResult;

  try{
    bodyResult = await getBodyForReply(action, event);
    console.log(bodyResult);
    statusCode = 200;
  }catch (e){
    console.log(e);
    bodyResult = { error: e.message };
    statusCode = 500;
  }

  return {
    statusCode,
    body: JSON.stringify(bodyResult),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
  };

  //bodyResult= await getBodyForReply(action,event);
  
  


  
  //Get data for the incoming id
  
  //If it exists Compare the dates and derive changed value else
  
  //changed value = yes
  //Save the new inspection
  //Send out the confirmation response, changed value, success, etc

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
  async function formatSingleJob(jobInfo,jobN){
    console.log("IN formatSingleJob");
    if(jobInfo.hasOwnProperty("success")){
      if(jobInfo.success !== true){
        return { chJO: {}, chlist: [], eqCurrent:"", eqad:"", jnum: jobN, dCount: 0, rCount: 0, sCount: 0, oCount: 0,  personList: [], table3:[], table4:[] };
      }
    }

    //let finalObj={ chJO: {}, chlist: [], eqCurrent:"", eqad:"", jnum: jobN, dCount: 0, rCount: 0, sCount: 0, oCount: 0,  personList: [], table3:[] };
    let tempEqList=jobInfo.equipList;
    let eqSet= new Set();
    let justeqIDS= new Set();
    let eqListJN=[];
    console.log("()()()");
    tempEqList.forEach((item) => {
      console.log(item);
      let testCount=tempEqList.filter(x=> x.equip === item.equip);
      justeqIDS.add(item.equip);
      //console.log(`For eq:${item.equip} there are ${testCount.length} matches`);
      if(testCount.length >1){
        testCount.sort( function (a, b) {
          return (b.recNum) - (a.recNum);
        });
        eqSet.add(testCount[0]);
        //eqListJN.push(testCount[0]);
        //console.log(testCount[0]);
        //console.log(item);
        //console.log(`EQ:${item.equip} has ${testCount.length} matches in this list`);
      }else{
        eqSet.add(item);
      }
    });
    eqListJN=Array.from(eqSet);
    console.log(`@@@ ${tempEqList.length} -> ${eqListJN.length}`);

    let tsDoubleCheck=jobInfo.DataFor;
    console.log("TIME STUFF PT1");
    console.log(tsDoubleCheck);

    const tsForData= timefunc.newExtraCheck(tsDoubleCheck);
    console.log("DONE TIME STUFF PT1");
    console.log("Done with extraCheck IN formatSingleJob");
    console.log(tsForData);

    //let eqListJN=jobInfo.equipList;
    
    prodOnly.config.update({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region
    });
    
    /*
    prodOnly.config.update({
      accessKeyId: configProd.accessKeyId,
      secretAccessKey: configProd.secretAccessKey,
      region: config.region
    });
    */
    
    const athenaExpressConfigTwo = {
      aws: prodOnly,
      db: "ibtdb",
      getStats: true
    };
    const athenaExpressTwo = new AthenaExpress(athenaExpressConfigTwo);

    const qTextCurrent=`SELECT equipmentnumber, phonenumberofinspector, certifier, meterreading  FROM ibtdb.tempmdvformdata WHERE jobnumber LIKE '${jobN}%' AND dayatmid = '${tsForData}'`;

    const queryCur= await athenaExpressTwo.query(qTextCurrent);
    var listCur=queryCur.Items;

    let inspectedButDoesNotMatchDispatch=[];
    let eqIdInspectionNotdispatched=[];
    listCur.forEach((li)=>{
       //For each item, check to see if theyre in the outstandingISSuesCount, if not and theres an issue, add it
       if(justeqIDS.has(li.equipmentnumber)){
         //inspection is accounted for
       }else{
         //inspection is not accounted for
         console.log(li);
         eqIdInspectionNotdispatched.push(li.equipmentnumber);
         inspectedButDoesNotMatchDispatch.push(li);
       }
       
    });



    

    let rentaleqNums=[];
    //^Number of rentals at job site
    let eqNums=[];
    //^Number of other. (eqListJN= eqNums + rentaleqNums)
    
    let whereEquips = "(";
    for(var i=0;i<eqListJN.length; i++){
        var item= eqListJN[i];
        if (i == 0) {
           //whereEquips = "equip = "
           whereEquips = whereEquips.concat("equipmentnumber = '" + item.equip.replace("'","''").toString() + "'");
        } else {
           //whereEquips = "or equip = "
           whereEquips = whereEquips.concat(" or equipmentnumber = '" + item.equip.replace("'","''").toString() + "'");
        }

      if ((item.equip).length === 6 && ((item.equip).charAt(0) !== "0")) {
        //Add to rental
        rentaleqNums.push(item);
      } else if ((item.equip).length === 6 && ((item.equip).charAt(0) === "0")) {
        //Add to others
        eqNums.push(item);
      } else {
        //Add to others
        eqNums.push(item);
      }
    }
    if(eqListJN.length>0 && eqIdInspectionNotdispatched.length >0) {
      //'non dispatched' equipment need to be included in the issue/comment query 
      eqIdInspectionNotdispatched.forEach((eqID) => {
        whereEquips = whereEquips.concat(" or equipmentnumber = '" + eqID.replace("'","''").toString() + "'");
      });
    }else {
      for(var i=0;i<eqIdInspectionNotdispatched.length; i++){
          var item= eqIdInspectionNotdispatched[i];
          if (i == 0) {
             //whereEquips = "equip = "
             whereEquips = whereEquips.concat("equipmentnumber = '" + item.replace("'","''").toString() + "'");
          } else {
             //whereEquips = "or equip = "
             whereEquips = whereEquips.concat(" or equipmentnumber = '" + item.replace("'","''").toString() + "'");
          }
      }
      
    }
    whereEquips = whereEquips.concat(")");
    const qText=`SELECT issuecategory, issuestatus, equipmentnumber, assetdescription, phonenumberofinspector, certifier, timestamp FROM ibtdb.singleissues WHERE ${whereEquips}`;
    console.log(qText);

    const qTextCom=`SELECT othercomments, equipmentnumber, instant, phonenumberofinspector, timestamp, certifier  FROM ibtdb.comments WHERE ${whereEquips}`;
    console.log(qTextCom);
    //^ This information is always updated and current

    
    //const qTextCurrent=`SELECT equipmentnumber, phonenumberofinspector, certifier, meterreading  FROM ibtdb.tempmdvformdata WHERE jobnumber LIKE '${jobN.replace("-","")}%' AND dayatmid = '${tsForData}'`;
    
    //const qTextCurrent=`SELECT equipmentnumber, phonenumberofinspector, certifier, meterreading  FROM ibtdb.tempmdvformdata WHERE dayatmid = '${tsForData}' AND ${whereEquips}`;
    //const qTextCurrent=`SELECT equipmentnumber, phonenumberofinspector, certifier, meterreading  FROM ibtdb.tempmdvformdata WHERE jobnumber = '${jobN}' AND dayatmid = '${tsForData}'`;
    //const qTextCurrent=`SELECT equipmentnumber, phonenumberofinspector, certifier, meterreading  FROM ibtdb.tempmdvformdata WHERE dayatmid = '${tsForData}'`;
    //Theres a bug here, only checks one job number not the children
    console.log(qTextCurrent);
    //^This information is for a
    //athenaExpressTwo
    /*
    prodOnly.config.update({
      accessKeyId: configProd.accessKeyId,
      secretAccessKey: configProd.secretAccessKey,
      region: config.region
    });
    const athenaExpressConfigTwo = {
      aws: prodOnly,
      db: "ibtdb",
      getStats: true
    };
    const athenaExpressTwo = new AthenaExpress(athenaExpressConfigTwo);
    */
    console.log("About to try athena");
    const [athenaError, queryA] = await to(athenaExpressTwo.query(qText));

    if (athenaError != null) {
        console.log("***Error on querying athena:")
        console.log(athenaError);
        console.log("===================Exit the function because the details of the query through athena couldn't be got");
        //callback(null, { body: JSON.stringify({ "success": false, "errorMessage": "Athena couldn't get data" }), "statusCode": 200 });
        return {"success": false, "errorMessage": "Athena couldn't get data"};
    }
    //const queryA= await athenaExpressTwo.query(qText);
    var list=queryA.Items;
    console.log("Done with first");
    const queryC= await athenaExpressTwo.query(qTextCom);
    var listC=queryC.Items;
    console.log("Done with Second");

    //const queryCur= await athenaExpressTwo.query(qTextCurrent);
    //var listCur=queryCur.Items;

    console.log("Done with Third");
    console.log(listCur);
    console.log("getting done to work");
    //^Inspections submitted today for job site

    //for listCur you have entries that are not in the original dispatch

    
    
    
    
    let singleIssueEQ=[];
    let commentsEQ=[];

    let outstandingIssuesCount=[];
    let unverifiedEQ=[];

    let finalAllEq=[];
    console.log("*&*&*");
    eqNums.forEach((I2)=>{
        const filteredForEq=list.filter(x=> x.equipmentnumber === I2.equip);
        const filteredForEqC=listC.filter(x=> x.equipmentnumber === I2.equip);
      var filteredForEqCur;


      if (I2.equip.charAt(0)=== 0) {
        filteredForEqCur = listCur.filter(x => "0" + x.equipmentnumber === I2.equip);
      } else {
        filteredForEqCur = listCur.filter(x => x.equipmentnumber === I2.equip);
      }
        //^Number of inspections submitted for this rental
        let newObj=I2;
        let outCount=filteredForEq.length+filteredForEqC.length;//outstandingIssuesCount
        console.log(outCount);
        if(outCount !== 0){
          console.log(I2);
          outstandingIssuesCount.push(I2);
        }
        newObj.Icount=filteredForEq.length+filteredForEqC.length;
        //^Outstanding issues for each item that was dispatched
        newObj.inIns=filteredForEqCur.length;
        if(filteredForEqCur.length === 0){
            //There is no properly submitted inspection for this eq
            I2.inIn="No";
            I2.renderColor=""
            unverifiedEQ.push(I2);
        }else{
            I2.inIn="Yes";
            I2.renderColor=""
            unverifiedEQ.push(I2);
        }
        newObj.reportLink=`${config.directeqlinkprefix}${I2.equip}`;
        finalAllEq.push(newObj);
        
    });

    let finalRentalEq=[];
    console.log("*&*&*");
    rentaleqNums.forEach((I2)=>{
        const filteredForEq=list.filter(x=> x.equipmentnumber === I2.equip);
        const filteredForEqC=listC.filter(x=> x.equipmentnumber === I2.equip);
        const filteredForEqCur=listCur.filter(x=> x.equipmentnumber === I2.equip);
        //^Number of inspections for this rental

        let outCount=filteredForEq.length+filteredForEqC.length;//outstandingIssuesCount
        console.log(outCount);
        if(outCount !== 0){
           console.log(I2);
           outstandingIssuesCount.push(I2);
        }
        let newObj=I2;
        newObj.Icount=filteredForEq.length+filteredForEqC.length;
        //^Outstanding issues for each item that was dispatched
        newObj.inIns=filteredForEqCur.length;
        if(filteredForEqCur.length === 0){
           //There is no properly submitted inspection for this eq
           I2.inIn="No";
           I2.renderColor="#ffa500"
           unverifiedEQ.push(I2);
        }else{
           I2.inIn="Yes";
           I2.renderColor="#ffa500"
           unverifiedEQ.push(I2);
        }
        newObj.reportLink=`${config.directeqlinkprefix}${I2.equip}`;


        finalRentalEq.push(newObj);
        
     });

     eqIdInspectionNotdispatched.forEach((I2)=>{
      const filteredForEq=list.filter(x=> x.equipmentnumber === I2);
      const filteredForEqC=listC.filter(x=> x.equipmentnumber === I2);
      
      //^Number of inspections for this rental

      let outCount=filteredForEq.length+filteredForEqC.length;//outstandingIssuesCount
      console.log(outCount);
      if(outCount !== 0){
         console.log(I2);
         let fauxI2={};
         fauxI2.equip = I2;
         outstandingIssuesCount.push(fauxI2);
         //I2 needs to have an equipment value and thats it example I3.equip
      }
      
      
   });

     unverifiedEQ=unverifiedEQ.sort( function (a, b) {
        return (b.equip) - (a.equip);
      }).reverse();

     outstandingIssuesCount=outstandingIssuesCount.sort( function (a, b) {
        return (b.equip) - (a.equip);
      }).reverse();

      let outstandingIssues=[];
      let testJ={};
      outstandingIssuesCount.forEach((I3)=>{
         //Each Item has either an issue or comment or both.
         //The goal is to combine them into one object with a field for issues and comments
         //Additionally Asset Desc and eq id
         //These objects will be used to display the broken details for each individual obj

         let finalOutIssue={};
         let ad="";

         const filteredForEq=list.filter(x=> x.equipmentnumber === I3.equip);
         //open issue query from athena 
         let issueExtracted=[];
         filteredForEq.forEach((item)=>{
            
            if(("assetdescription" in item)==false){
               console.log("No assetdescription");
               //sendObj.com = [];
            }else{
              console.log(item.assetdescription);
              ad=item.assetdescription;
            }
            issueExtracted.push({ ic: `${item.issuecategory}`, is:`${item.issuestatus}`, fn:`${item.certifier}`, pn: `${item.phonenumberofinspector}`, date: `${item.timestamp}` , k2: `${item.equipmentnumber}_${item.issuecategory}` });
         });
         finalOutIssue.eqAD= `${ad}`;
         finalOutIssue.eqid= `${I3.equip}`;
         if(issueExtracted.length>0){
            finalOutIssue.issues=issueExtracted;
         }else{
            finalOutIssue.issues=[];
         }
         let commentSet=new Set();
         let hiddenID=new Set();
         let commentExtracted=[];
         let hiddencommentExtracted=[];

         const filteredForEqC=listC.filter(x=> x.equipmentnumber === I3.equip);
         //Comments query from athena
         filteredForEqC.forEach((item)=>{
            if(commentSet.has(item.othercomments)){
               //Already has this body
               const filteredComments=commentExtracted.filter(x=> x.url === item.othercomments);
               console.log("showing filter")
               console.log(filteredComments[0].k);
               hiddenID.add(filteredComments[0].k);
               hiddencommentExtracted.push({pn: `${filteredComments[0].k}`, url:`${item.othercomments}`, date: `${item.timestamp}`, fn: `${item.certifier}`, k: `${item.equipmentnumber}_${item.instant}` });
            }else{
             commentSet.add(item.othercomments);
             commentExtracted.push({pn: `${item.phonenumberofinspector}`, url:`${item.othercomments}`, date: `${item.timestamp}`, fn: `${item.certifier}`, k: `${item.equipmentnumber}_${item.instant}` });
            }
         });
         let arrayHidden=Array.from(hiddenID);
         let hiddenJO={};
         arrayHidden.forEach((item) => {
           const hiddenFilter=hiddencommentExtracted.filter(x=> x.pn === item);
           let hiddenValue=[];
           hiddenFilter.forEach((i2) => {
             hiddenValue.push(i2.k);
           });
           hiddenJO[item]=hiddenValue;
         });
         console.log(hiddenJO);


         if(commentExtracted.length>0){
            let extractObj={};
            extractObj.comments=commentExtracted;
            extractObj.hiddenComments=hiddencommentExtracted;
            extractObj.hiddenObj=hiddenJO;
            //commentsEQ.push(extractObj);

            finalOutIssue.comments=extractObj;
            
         }else{
            finalOutIssue.comments={comments:[],hiddenComments:[], hiddenObj: hiddenJO};
         }
         testJ[I3.equip]=finalOutIssue;
         //outstandingIssues
         outstandingIssues.push(finalOutIssue);


      });
      console.log("#%& Extracting inspections that do not match dispatch");
      /*
      let inspectedButDoesNotMatchDispatch=[];
      let eqIdInspectionNotdispatched=[];
      listCur.forEach((li)=>{
         //For each item, check to see if theyre in the outstandingISSuesCount, if not and theres an issue, add it
         if(justeqIDS.has(li.equipmentnumber)){
           //inspection is accounted for
         }else{
           //inspection is not accounted for
           console.log(li);
           eqIdInspectionNotdispatched.push(li.equipmentnumber);
           inspectedButDoesNotMatchDispatch.push(li);
         }
         
      });
      console.log("done with not matched");
      */
      console.log("Gonna try to look up not dispatched data");
      let nonDispatchInspected=[];
      if(eqIdInspectionNotdispatched.length > 0){
        const temptestData=await getAidsDataForInaccurateDispatch(eqIdInspectionNotdispatched,tsForData);
        console.log("Done with getAidsDataForInaccurateDispatch IN formatSingleJob");
        console.log(temptestData);
        
        temptestData.equipList.forEach((Item) => {
          //have to add inIn and renderColor to each item, then add it to another array
          let tempItem=Item;
          
          tempItem.inIn = "Yes";
          if ((Item.equip).length === 6 && ((Item.equip).charAt(0) !== "0")) {
            //its a rental
            tempItem.renderColor = "#ffa500";
          } else if ((Item.equip).length === 6 && ((Item.equip).charAt(0) === "0")) {
            //Its not a rental
            tempItem.renderColor = "";
          } else {
            //Its not a rental
            tempItem.renderColor = "";
          }

          nonDispatchInspected.push(tempItem);
        });

      }
      
      console.log("Done with not matched aids data pull");

      let currentInspections=listCur;
      //Inspections for that day
      finalAllEq=finalAllEq.sort( function (a, b) {
        return (b.equip) - (a.equip);
      }).reverse();
      finalRentalEq=finalRentalEq.sort( function (a, b) {
        return (b.equip) - (a.equip);
      }).reverse();
      currentInspections=currentInspections.sort( function (a, b) {
        return (b.equipmentnumber) - (a.equipmentnumber);
      }).reverse();

      nonDispatchInspected=nonDispatchInspected.sort( function(a,b) {
        return (b.equip) - (a.equip);
      }).reverse();
      const joText=JSON.stringify(testJ);
      /*
      let eqCData;
      let eqADData;
      if(outstandingIssues.length >0){
        eqCData=outstandingIssues[0].eqid;
        eqADData=outstandingIssues[0].eqAD;
      }else{
        eqCData="";
        eqADData="";
      }
      */

      // eqCurrent:eqCData, eqad:eqADData, personList: eqListJN,
      let finalObj={ chJO: testJ, chlist: outstandingIssues, jnum: jobN, dCount: eqListJN.length, rCount: rentaleqNums.length, sCount: listCur.length, oCount: outstandingIssuesCount.length, noCount: inspectedButDoesNotMatchDispatch.length, table3:unverifiedEQ, table4:nonDispatchInspected };

      //let finalObj={ chJO: testJ, chlist: outstandingIssues, eqCurrent:eqCData, eqad:eqADData, jnum: jobN, dCount: eqListJN.length, rCount: rentaleqNums.length, sCount: listCur.length, oCount: outstandingIssuesCount.length,  personList: eqListJN, table3:unverifiedEQ };
      //let finalObj={ chJO: testJ, chlist: outstandingIssues, eqCurrent:eqCData, eqad:eqADData, jnum: jobN, dCount: eqListJN.length, rCount: rentaleqNums.length, sCount: listCur.length, oCount: outstandingIssuesCount.length,  personList: eqListJN, table2: outstandingIssues[0].issues, table: outstandingIssues[0].comments.comments, table3:unverifiedEQ, tableHidden: outstandingIssues[0].comments.hiddenComments };

      return finalObj;
  }
  async function getBodyForReply(action, event){
    if (action == "addData") {
      const jobNum = event.queryStringParameters.jn.trim();
      const jobInfo= await getEqByJobNumber(jobNum);
      console.log("Got some data from aids");
      console.log(jobInfo);
      console.log("formatting response");
      const jobInfoObj= await formatSingleJob(jobInfo,jobNum);
      console.log("Completed addData Flow");
      //callback(null, { body: JSON.stringify(jobInfo), "statusCode": 200 });
      return jobInfoObj;
      
    }else if (action == "getJN") {
      const jobNInfo= await getAllJobNumbers();
      console.log(jobNInfo);
      console.log("Completed getJN Flow");
      //callback(null, { body: JSON.stringify(jobNInfo), "statusCode": 200 });
      return jobNInfo;
      
    }else if(action == "getJNDate"){
      const dts = event.queryStringParameters.datets;
  
      console.log(dts);
  
      const jobsandInfo= await getAllJobNumbersByDay(dts);
      console.log("Completed getJNDate Flow");
      //callback(null, { body: JSON.stringify(jobsandInfo), "statusCode": 200 });
      return jobsandInfo;
    }else if (action == "addDataDate") {
      const dts = event.queryStringParameters.datets;
  
      const jobNum = event.queryStringParameters.jn.trim();
      const jobInfo= await getEqByJobNumberSelectedDate(jobNum,dts);
      console.log("Got some data from aids");
      console.log(jobInfo);
      console.log("formatting");
      const jobInfoObj= await formatSingleJob(jobInfo,jobNum);
      console.log("Completed addDatADate Flow");
      //callback(null, { body: JSON.stringify(jobInfo), "statusCode": 200 });
      return jobInfoObj;
      
    }

  }

  

  async function  getEqByJobNumber(equipID){
    console.log("IN getEqByJobNumber");

    const currentDayTimestamp=timefunc.getCurrentDayTSSafeMethod();

    console.log("Done with currentDayTimestamp in getEqByJobNumber");
    let obj = { equipList: [] };
    obj.DataFor= currentDayTimestamp;

    const aidsFileData= await lookupEQDataThroughAidsFilteredByJob(currentDayTimestamp,equipID);
    console.log("Done with lookupEQDataThroughAidsFilteredByJob in getEqByJobNumber");
    if(aidsFileData.success === false){
      console.log("lookupEQDataThroughAidsFilteredByJob failed");
      return aidsFileData;
    }

    let selectedDispatchEquipments = aidsFileData.fileData;
    const query=await formatAidsDispatchForQuery(selectedDispatchEquipments);
    console.log("Done with formatAidsDispatchForQuery in getEqByJobNumber");
    console.log(query);
    const dataFromAthena=await aidsAthenaQ(query);
    console.log("Done with aidsAthenaQ IN getEqByJobNumber");
    if(dataFromAthena.success === false){
      console.log("aidsAthenaQ failed");
      return dataFromAthena;
    }
    let equipNotes = [];

    equipNotes = dataFromAthena.aData.Items;

    const finalObj= await createObjFromAidsDispatchAndAthena(obj, equipNotes, selectedDispatchEquipments)
    console.log("Done with createObjFromAidsDispatchAndAthena IN getEqByJobNumber");

    return finalObj;

  }
  async function checkEqForDispatchInfo(eqIdInspectionNotdispatched,timeStampMid){
    console.log("IN checkEqForDispatchInfo");
    //This will be used for figuring out aids data of inspections that dont match the dispatch
    const aidsDispatchData= await getEqDispatchDataFromAids(timeStampMid);
    console.log("Done with getEqDispatchDataFromAids IN checkEqForDispatchInfo");
    if(aidsDispatchData.success === false){
      return aidsDispatchData;
    }
    let equipAssignment = aidsDispatchData.payload;

    let selectedEquipIDData= [];

    eqIdInspectionNotdispatched.forEach((item) => {
      //each item is an equipment 

      //Filter equipAssignment by item for the eq id
      const tempselectedEquipIDData = equipAssignment.filter(e => e.equip.toString()===(item)   && (e.IUDAction == 'U' || e.IUDAction == 'I') && (e.equip.includes("OVS")!=true) );
      selectedEquipIDData.push(...tempselectedEquipIDData); 
    });

    console.log("Size: "+ selectedEquipIDData.length);

    if (typeof selectedEquipIDData[0] == 'undefined' || selectedEquipIDData.length == 0) {
      console.log("841");
        console.log("***The process of IBTgetDATA has finished unsuccessfully");
        //callback(null, { body: JSON.stringify({ "success": true, "data": { "equip": equipID, "jobNumber": 'NA' } }), "statusCode": 200 });
        return { "success": false, "errorMessage": "Athena couldn't get data" };
    }//^Nothing matched the equip id for the day

    
    //let selectedDispatchEquipments = selectedEquipIDData;
    return {"success": true, "fileData": selectedEquipIDData};

  }
  async function getAidsDataForInaccurateDispatch(eqIdInspectionNotdispatched,timeStampMid){
    console.log("IN getAidsDataForInaccurateDispatch");
    let obj = { equipList: [] };
    obj.DataFor= timeStampMid;

    /*
    const aidsFileData= await checkEqForDispatchInfo(eqIdInspectionNotdispatched,timeStampMid);
    if(aidsFileData.success === false){
      console.log("lookupEQDataThroughAidsFilteredByJob failed");
      return aidsFileData;
    }

    let selectedDispatchEquipments = aidsFileData.fileData;
    */
    //This will only have equipment that is dispatched for that day, 
    let equipNotes = [];

    const query=await formatAidsNonDispatchForQuery(eqIdInspectionNotdispatched);
    console.log("Done with formatAidsNonDispatchForQuery IN getAidsDataForInaccurateDispatch");
    console.log(query);

    const dataFromAthena=await aidsAthenaQ(query);
    console.log("Done with aidsAthenaQ IN getAidsDataForInaccurateDispatch");
    if(dataFromAthena.success === false){
      console.log("aidsAthenaQ failed");
      return dataFromAthena;
    }
    equipNotes = dataFromAthena.aData.Items;

    const finalObj= await createObjFromAidsNonDispatchAndAthena(obj, equipNotes, eqIdInspectionNotdispatched);//
    console.log("Done with createObjFromAidsNonDispatchAndAthena IN getAidsDataForInaccurateDispatch");
    return finalObj;
  }

  async function getEqDispatchDataFromAids(timeStampMid){
    console.log("In getEqDispatchDataFromAids");
    const promiseForEquipDispatches = createPromiseDownloadDispatchData('equipAssignment', timeStampMid);
    console.log("Done with createPromiseDownloadDispatchData IN getEqDispatchDataFromAids");
    const [responseError, responseData] = await to(Promise.all([promiseForEquipDispatches]));
    console.log('Done getting dispatch data at the moment for the day');
    //#endregion get equipAssignment and employeeAssignment
    
    let equipAssignment = {};

    for (let i = 0; i < responseData.length; i++) {
      const response = responseData[i];
      console.log(JSON.stringify(response));
      if (response.success) {
          if (response.filename == 'equipAssignment') {
              equipAssignment = response.data.Equips;
          }
      }

      if (!response.success ) {
        console.log("902");
          console.log("***The process of IBTgetDATA has finished unsuccessfully");
          //callback(null, { body: JSON.stringify({ "success": true, "data": { "equip": equipID, "jobNumber": 'NA' } }), "statusCode": 200 });
          return { "success": false, "errorMessage": "Athena couldn't get data" };
      }
    }

    return {"success": true, "payload": equipAssignment};
  }

  async function lookupEQDataThroughAidsFilteredByJob(timeStampMid,equipID){
    console.log("IN lookupEQDataThroughAidsFilteredByJob");
    const aidsDispatchData= await getEqDispatchDataFromAids(timeStampMid);
    console.log("Done with getEqDispatchDataFromAids IN lookupEQDataThroughAidsFilteredByJob");
    if(aidsDispatchData.success === false){
      return aidsDispatchData;
    }
    let equipAssignment = aidsDispatchData.payload;
    console.log("Size: "+ equipAssignment.length);
    const selectedEquipIDData = equipAssignment.filter(e => e.moveTo.toString().includes(equipID)   && (e.IUDAction == 'U' || e.IUDAction == 'I') && (e.equip.includes("OVS")!=true) );
    //^Filters down any matches with the job number for the days s3 dispatch file
    console.log("Size: "+ selectedEquipIDData.length);

    if (typeof selectedEquipIDData[0] == 'undefined' || selectedEquipIDData.length == 0) {
      console.log("925");
        console.log("***The process of IBTgetDATA has finished unsuccessfully");
        //callback(null, { body: JSON.stringify({ "success": true, "data": { "equip": equipID, "jobNumber": 'NA' } }), "statusCode": 200 });
        return { "success": false, "errorMessage": "Athena couldn't get data" };
    }//^Nothing matched the equip id for the day

    
    //let selectedDispatchEquipments = selectedEquipIDData;
    return {"success": true, "fileData": selectedEquipIDData};
  }

  async function aidsAthenaQ(query){
    console.log("IN aidsAthenaQ");
    aidsaws.config.update({
      accessKeyId: config.eqInfoKeyNew,
      secretAccessKey: config.eqSecretKeyNew,
      region: config.databaseRegion
    });
    
    /*
    aidsaws.config.update({
      accessKeyId: configQA.eqInfoKeyNew,
      secretAccessKey: configQA.eqSecretKeyNew,
      region: configProd.databaseRegion
    });
    */
    
    
    const aidss3= new aidsaws.S3();
    
    const athenaExpressConfig = {
      aws: aidsaws,
      db: "dispatches",
      getStats: true
    };
    const athenaExpress = new AthenaExpress (athenaExpressConfig);
    //Gets that information for equiplist whereEquips -> ('EQ1','EQ2','EQ3')
    const [athenaError, athenaData] = await to(athenaExpress.query(query));

    if (athenaError != null) {
        console.log("***Error on querying athena 1:")
        console.log(athenaError);
        console.log("===================Exit the function because the details of the query through athena couldn't be got");
        //callback(null, { body: JSON.stringify({ "success": false, "errorMessage": "Athena couldn't get data" }), "statusCode": 200 });
        return {"success": false, "errorMessage": "Athena couldn't get data"};
    }

    return {"success": true, "aData":athenaData};
  }

  async function formatAidsNonDispatchForQuery(selectedDispatchEquipments){
    console.log("IN formatAidsNonDispatchForQuery");
    let whereEquips = "(";
    for (let d = 0; d < selectedDispatchEquipments.length; d++) {
        if (d == 0) {
            whereEquips = whereEquips.concat("'" + selectedDispatchEquipments[d].replace("'","''").toString() + "'");
        } else {
            whereEquips = whereEquips.concat(",'" + selectedDispatchEquipments[d].replace("'","''").toString() + "'");
        }
    }
    whereEquips = whereEquips.concat(")");

    let query = `select eq.equip, eq.name, eq.category, eq.status, eq.jobnumber, tp.description, tp.type from ${config.aidsAthenaTable}.equipmentnotes eq left join ${config.aidsAthenaTable}.types tp on eq.category = tp.type where equip in ${whereEquips}`;
    //let query = `select eq.equip, eq.name, eq.category, eq.status, eq.jobnumber, tp.description, tp.type from dispatches.equipmentnotes eq left join dispatches.types tp on eq.category = tp.type where equip in ${whereEquips}`;
    //eq.status, eq.jobnumber,
    return query;
  }

  async function formatAidsDispatchForQuery(selectedDispatchEquipments){
    console.log("In formatAidsDispatchForQuery");
    let whereEquips = "(";
    for (let d = 0; d < selectedDispatchEquipments.length; d++) {
        if (d == 0) {
            whereEquips = whereEquips.concat("'" + selectedDispatchEquipments[d].equip.replace("'","''").toString() + "'");
        } else {
            whereEquips = whereEquips.concat(",'" + selectedDispatchEquipments[d].equip.replace("'","''").toString() + "'");
        }
    }
    whereEquips = whereEquips.concat(")");

    let query = `select eq.equip, eq.name, eq.category, tp.description, tp.type from ${config.aidsAthenaTable}.equipmentnotes eq left join ${config.aidsAthenaTable}.types tp on eq.category = tp.type where equip in ${whereEquips}`;
    //let query = `select eq.equip, eq.name, eq.category, tp.description, tp.type from dispatches.equipmentnotes eq left join dispatches.types tp on eq.category = tp.type where equip in ${whereEquips}`;
    //eq.status, eq.jobnumber,
    return query;
  }

  async function createObjFromAidsNonDispatchAndAthena(obj, equipNotes, eqIdInspectionNotdispatched){
    console.log("In createObjFromAidsNonDispatchAndAthena");
    let objectDataFilter= await getObjectP();
    console.log("Done with getObjectP IN createObjFromAidsNonDispatchAndAthena");
    console.log("odf");
    console.log(objectDataFilter);

    //equipNotes = athenaData.Items;
    //#region put Equip Data into obj
    let index = 0;
    var addInfo=false;
    for (let e = 0; e < eqIdInspectionNotdispatched.length; e++) {
        addInfo=false;
        //obj.equipList[index] = {};
        //obj.equipList[index].equip = selectedDispatchEquipments[e].equip;
        //obj.equipList[index].jn = selectedDispatchEquipments[e].moveTo;
        for (let n = 0; n < equipNotes.length; n++) {
            if (eqIdInspectionNotdispatched[e] == equipNotes[n].equip ) {
              console.log(`Cate Date: ${equipNotes[n].category} -> ${(equipNotes[n].category in objectDataFilter)}`);
              if(!(equipNotes[n].category in objectDataFilter) && (equipNotes[n].category !== "ATT")){
                addInfo=true;
                obj.equipList[index] = {};

                //obj.equipList[index].equip = selectedDispatchEquipments[e].equip;
                //obj.equipList[index].jn = selectedDispatchEquipments[e].moveTo;
                //obj.equipList[index].recNum = selectedDispatchEquipments[e].recNum;

                obj.equipList[index].equip = (typeof equipNotes[n].equip != 'undefined' ? equipNotes[n].equip : '');
                obj.equipList[index].jn = (typeof equipNotes[n].jobnumber != 'undefined' ? equipNotes[n].jobnumber : '');
                obj.equipList[index].recNum = '';



                obj.equipList[index].name = (typeof equipNotes[n].name != 'undefined' ? equipNotes[n].name : '');
                obj.equipList[index].categoryName = (typeof equipNotes[n].description != 'undefined' ? equipNotes[n].description : '');

              }
                
            };
        };
        if(addInfo){
          index++;
        }
        
    };
    return obj;
  }

  async function createObjFromAidsDispatchAndAthena(obj, equipNotes, selectedDispatchEquipments){
    console.log("IN createObjFromAidsDispatchAndAthena");
    let objectDataFilter= await getObjectP();
    console.log("Done with getObjectP IN createObjFromAidsDispatchAndAthena");
    console.log("odf");
    console.log(objectDataFilter);

    //equipNotes = athenaData.Items;
    //#region put Equip Data into obj
    let index = 0;
    var addInfo=false;
    for (let e = 0; e < selectedDispatchEquipments.length; e++) {
        addInfo=false;
        //obj.equipList[index] = {};
        //obj.equipList[index].equip = selectedDispatchEquipments[e].equip;
        //obj.equipList[index].jn = selectedDispatchEquipments[e].moveTo;
        for (let n = 0; n < equipNotes.length; n++) {
            if (selectedDispatchEquipments[e].equip == equipNotes[n].equip ) {
              console.log(`Cate Date: ${equipNotes[n].category} -> ${(equipNotes[n].category in objectDataFilter)}`);
              if(!(equipNotes[n].category in objectDataFilter) && (equipNotes[n].category !== "ATT") ){
                addInfo=true;
                obj.equipList[index] = {};

                obj.equipList[index].equip = selectedDispatchEquipments[e].equip;
                obj.equipList[index].jn = selectedDispatchEquipments[e].moveTo;
                obj.equipList[index].recNum = selectedDispatchEquipments[e].recNum;
                obj.equipList[index].name = (typeof equipNotes[n].name != 'undefined' ? equipNotes[n].name : '');
                obj.equipList[index].categoryName = (typeof equipNotes[n].description != 'undefined' ? equipNotes[n].description : '');


                obj.equipList[index].attachTo = (typeof selectedDispatchEquipments[e].attachTo != 'undefined' ? selectedDispatchEquipments[e].attachTo : '');
                obj.equipList[index].category = (typeof equipNotes[n].category != 'undefined' ? equipNotes[n].category : '');
                obj.equipList[index].categoryType = (typeof equipNotes[n].type != 'undefined' ? equipNotes[n].type : '');
              }
                
            };
        };
        if(addInfo){
          index++;
        }
        
    };
    return obj;
  }

  async function  getEqByJobNumberSelectedDate(equipID,currentDayTimestamp){
    //#endregion put Equip Data into obj
    console.log("In getEqByJobNumberSelectedDate");
    let obj = { equipList: [] };
    obj.DataFor= currentDayTimestamp;

    const aidsFileData= await lookupEQDataThroughAidsFilteredByJob(currentDayTimestamp,equipID);
    console.log("Done with lookupEQDataThroughAidsFilteredByJob in getEqByJobNumberSelectedDate");
    if(aidsFileData.success === false){
      console.log("lookupEQDataThroughAidsFilteredByJob failed");
      return aidsFileData;
    }

    let selectedDispatchEquipments = aidsFileData.fileData;
    let equipNotes = [];

    const query=await formatAidsDispatchForQuery(selectedDispatchEquipments);
    console.log("Done with formatAidsDispatchForQuery in getEqByJobNumberSelectedDate");
    console.log(query);

    const dataFromAthena=await aidsAthenaQ(query);
    console.log("Done with aidsAthenaQ in getEqByJobNumberSelectedDate");
    if(dataFromAthena.success === false){
      console.log("aidsAthenaQ failed");
      return dataFromAthena;
    }
    equipNotes = dataFromAthena.aData.Items;

    const finalObj= await createObjFromAidsDispatchAndAthena(obj, equipNotes, selectedDispatchEquipments)
    console.log("Done with createObjFromAidsDispatchAndAthena in getEqByJobNumberSelectedDate");
    return finalObj;

  }


  async function  getAllJobNumbersByDay(currentDayTimestamp){
    console.log("IN getAllJobNumbersByDay");
    const promiseForEquipDispatches = createPromiseDownloadDispatchData('equipAssignment', currentDayTimestamp);
    console.log("Done with createPromiseDownloadDispatchData IN getAllJobNumbersByDay");
    //const promiseForEemployeeDispatches = createPromiseDownloadDispatchData('employeeAssignment', currentDayTimestamp);

    const [responseError, responseData] = await to(Promise.all([promiseForEquipDispatches]));
    console.log('Done getting dispatch data at the moment for the day');
    //#endregion get equipAssignment and employeeAssignment

    let dataSelected = [];
    let obj = {};
    obj.DataFor= currentDayTimestamp;
    let equipAssignment = {};
    

    for (let i = 0; i < responseData.length; i++) {
      const response = responseData[i];
      console.log(JSON.stringify(response));
      if (response.success) {
          if (response.filename == 'equipAssignment') {
              equipAssignment = response.data.Equips;
          }
          
      }

      if (!response.success ) {
        console.log("1299");
          console.log("***The process of IBTgetDATA has finished unsuccessfully");
          equipAssignment = [];
          //callback(null, { body: JSON.stringify({ "success": true, "data": { "equip": equipID, "jobNumber": 'NA' } }), "statusCode": 200 });
          //return;
      }
    }
    console.log("Size: "+ equipAssignment.length);
    let allDispatchedJobs=[];
    let setJN= new Set();
    equipAssignment.forEach((ite)=>{
      setJN.add(ite.moveTo);
    });
    allDispatchedJobs=Array.from(setJN);
    obj.allJobsToday=allDispatchedJobs;

    return obj;

  }

  async function  getAllJobNumbers(){
    console.log("IN getAllJobNumbers");
    /*
    const apiTK= await to (apigClientTK.invokeApi(pathParams, pathTemplateTK, methodCheckList, cparams, bodyApi));
    console.log(apiTK[1]);
    console.log(apiTK[1].data.dayatmid);
    const instantT=apiTK[1].data.message;
    const currentDayTimestamp = apiTK[1].data.dayatmid;
    */
   
   const currentDayTimestamp= timefunc.getCurrentDayTSSafeMethod();
   console.log("Done with getCurrentDayTS IN getAllJobNumbers");

    const promiseForEquipDispatches = createPromiseDownloadDispatchData('equipAssignment', currentDayTimestamp);
    console.log("Done with createPromiseDownloadDispatchData IN getAllJobNumbers");
    //const promiseForEemployeeDispatches = createPromiseDownloadDispatchData('employeeAssignment', currentDayTimestamp);

    const [responseError, responseData] = await to(Promise.all([promiseForEquipDispatches]));
    console.log('Done getting dispatch data at the moment for the day');
    //#endregion get equipAssignment and employeeAssignment

    let dataSelected = [];
    let obj = {};
    obj.DataFor= currentDayTimestamp;
    let equipAssignment = {};
    

    for (let i = 0; i < responseData.length; i++) {
      const response = responseData[i];
      console.log(JSON.stringify(response));
      if (response.success) {
          if (response.filename == 'equipAssignment') {
              equipAssignment = response.data.Equips;
          }
          
      }

      if (!response.success ) {
        console.log("1353");
          console.log("***The process of IBTgetDATA has finished unsuccessfully");
          equipAssignment = [];
          //callback(null, { body: JSON.stringify({ "success": true, "data": { "equip": equipID, "jobNumber": 'NA' } }), "statusCode": 200 });
          //return;
      }
    }
    console.log("Size: "+ equipAssignment.length);
    //if(equipAssignment.length)
    let allDispatchedJobs=[];
    let setJN= new Set();
    equipAssignment.forEach((ite)=>{
      setJN.add(ite.moveTo);
    });
    allDispatchedJobs=Array.from(setJN);
    obj.allJobsToday=allDispatchedJobs;

    return obj;

  }

  function createPromiseDownloadDispatchData(filename, timestamp) {
    console.log("In createPromiseDownloadDispatchData");
      return new Promise(async (resolve, reject) => {
        
          var locationForData = {
              Bucket: config.aidsS3Bucket,
              Key: "dispatch/incomingV2/" + timestamp + "/" + filename + ".json"
          };
          
          /*
          var locationForData = {
              Bucket: configQA.aidsS3Bucket,
              Key: "dispatch/incomingV2/" + timestamp + "/" + filename + ".json"
          };
          */
          

          const [error, data] = await to(aidss3.getObject(locationForData).promise());

          if (error != null) { resolve({ success: false, filename: filename, errorMessage: error, key: locationForData.Key }); return; };
          if (data != null) { resolve({ success: true, filename: filename, data: JSON.parse(data.Body.toString()), key: locationForData.Key }); return; }
      });
  }

  async function getObjectP() {
    console.log("In getObjectP");
    try {
      const params = {
        Bucket: config.bucket, // your bucket name,
        Key: 'EQData/ignorecategories.json' // path to the object you're looking for
      }

      const data = await s3.getObject(params).promise();

      return JSON.parse(data.Body.toString('utf-8'));
    } catch (e) {
      throw new Error(`Could not retrieve file from S3: ${e.message}`)
    }
  }
};
