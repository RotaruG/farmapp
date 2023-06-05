const config = require('./env.json')[process.env.STAGE || 'dev'];
const aws = require('aws-sdk');
const to = require('await-to-js').default;
const requestPromise = require('request-promise');
const apigClientFactory = require('aws-api-gateway-client').default;
const AthenaExpress = require("athena-express");

aws.config.update({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
});
const s3 = new aws.S3();
const athenaExpressConfig = { aws };
const athenaExpress = new AthenaExpress(athenaExpressConfig);

module.exports.index = async (event, context, callback) => {
    //#region check if action is not null
    if (typeof event.queryStringParameters.action != 'undefined') {
        const actionType = event.queryStringParameters.action.trim();

        //#region get currentDay timestamp
        const startOfDayTimestampResponse = await requestPromise(config.getGMTTimeStamp);
        const parsedStartOfDayTimestampResponse = JSON.parse(startOfDayTimestampResponse);
        const currentDayTimestamp = parsedStartOfDayTimestampResponse.data;
        //#endregion get currentDat timestamp

        //#region declare athena db/tables
        let database, table1, table2;
        if (process.env.STAGE == "prod" || process.env.STAGE == "qa") {
            database = "dispatches";
            table1 = "equipmentnotes";
            table2 = "types";
        }

        if (process.env.STAGE == "dev") {
            database = "sampledb";
            table1 = "equipmentnotes";
            table2 = "types";
        }
        //#endregion declare athena db/tables

        //#region get data by equipmentID
        if (actionType.toLowerCase() == 'getdatabyequipid') {
            //#region check if equip id received from user
            if (typeof event.queryStringParameters.equipID == 'undefined') {
                callback(null, { body: JSON.stringify({ "success": false, "errorMessage": 'equipID is undefined' }), "statusCode": 200 });
                return;
            }
            if (event.queryStringParameters.equipID.length == 0) {
                callback(null, { body: JSON.stringify({ "success": false, "errorMessage": 'Invalid equipment ID' }), "statusCode": 200 });
                return;
            }
            //#endregion check if equip id received from user

            const equipID = event.queryStringParameters.equipID.trim();
            console.log(`===================IBTgetDATA started the processing of action ${actionType}for equipment id : ${equipID}`);

            //#region get equipAssignment and employeeAssignment
            let equipDispatchData = {};
            const promiseForEquipDispatches = createPromiseDownloadDispatchData('equipAssignment', currentDayTimestamp);
            const promiseForEemployeeDispatches = createPromiseDownloadDispatchData('employeeAssignment', currentDayTimestamp);

            const [responseError, responseData] = await to(Promise.all([promiseForEquipDispatches, promiseForEemployeeDispatches]));
            //#endregion get equipAssignment and employeeAssignment

            let dataSelected = [];
            let equipAssignment = {};
            let employeeAssignment = {}; employeeAssignment.Employees = [];

            if (responseData != null) {
                for (let i = 0; i < responseData.length; i++) {
                    const response = responseData[i];
                    if (response.success) {
                        if (response.filename == 'equipAssignment') {
                            equipAssignment = response.data.Equips;
                        }
                        if (response.filename == "employeeAssignment") {
                            employeeAssignment = response.data.Employees;
                        }
                    }

                    if (!response.success && response.filename == "equipAssignment") {
                        console.log("***The process of IBTgetDATA has finished unsuccessfully");
                        callback(null, { body: JSON.stringify({ "success": true, "data": { "equip": equipID, "jobNumber": 'NA' } }), "statusCode": 200 });
                        return;
                    }
                }

                //#region select equip from equipAssignment and get data from equipNotes
                const selectedEquipIDData = equipAssignment.filter(e => e.equip.toString() == equipID && (e.IUDAction == 'U' || e.IUDAction == 'I'));
                //^Filters down any matches with the equip id for the days s3 dispatch file
                if (typeof selectedEquipIDData[0] == 'undefined' || selectedEquipIDData.length == 0) {
                    console.log("***The process of IBTgetDATA has finished unsuccessfully");
                    callback(null, { body: JSON.stringify({ "success": true, "data": { "equip": equipID, "jobNumber": 'NA' } }), "statusCode": 200 });
                    return;
                }//^Nothing matched the equip id for the day

                const promisesForEquipNotes = createPromiseDownloadEquip(equipID);//<-Downloads equipnotes from s3
                const [equipNotesError, equipNotesData] = await to(Promise.all([promisesForEquipNotes]));
                if (equipNotesError != null) {
                    console.log("***The process of IBTgetDATA has finished unsuccessfully");
                    callback(null, { body: JSON.stringify({ "success": false, "errorMessage": "Couldn't get the Equipment Info data" }), "statusCode": 200 });
                    return;
                }
                let equipData = equipNotesData[0].data;

                let typeInfo;
                if (typeof equipData.category != 'undefined' || equipData.category != '') {
                    const promiseForType = createPromiseDownloadTypes(equipData.category)
                    const [typeDataError, typeData] = await to(Promise.all([promiseForType]));
                    typeInfo = typeData[0].data;
                }
                //#endregion select equip from equipAssignment and get data from equipNotes

                for (let i = 0; i < selectedEquipIDData.length; i++) {
                    let obj = {}; obj.DispatchedEmp = [];
                    obj.equip = equipID.toString();
                    obj.startDateTimestamp = selectedEquipIDData[i].startDateTimestamp;
                    obj.attachTo = (typeof selectedEquipIDData[i].attachTo != 'undefined' ? selectedEquipIDData[i].attachTo : '');
                    obj.moveTo = (typeof selectedEquipIDData[i].moveTo != 'undefined' ? selectedEquipIDData[i].moveTo : '');
                    obj.moveFrom = (typeof selectedEquipIDData[i].moveFrom != 'undefined' ? selectedEquipIDData[i].moveFrom : '');
                    obj.type = (typeof equipData.type != 'undefined' ? equipData.type : '');
                    obj.name = (typeof equipData.name != 'undefined' ? equipData.name : '');
                    obj.category = (typeof equipData.category != 'undefined' ? equipData.category : '');
                    obj.categoryName = (typeof typeInfo.description != 'undefined' ? typeInfo.description : '');

                    const selectedEmployees = employeeAssignment.filter(e => e.jobNumber == selectedEquipIDData[i].moveTo);

                    //#region get data from dynamoDB for each employee
                    //IN CASE IT IS REQUESTED, NEED TO UPDATE THE DBLAYER WITH NEW ACTION 
                    //getEmployees() 
                    //#endregion

                    for (let e = 0; e < selectedEmployees.length; e++) {
                        obj.DispatchedEmp[e] = {};
                        obj.DispatchedEmp[e].HCSSIDEmployee = selectedEmployees[e].HCSSIDEmployee;
                    }
                    dataSelected.push(obj);
                };
            }

            callback(null, { body: JSON.stringify({ "success": true, "data": dataSelected }), "statusCode": 200 });
            return;
        }//<--- THis statement pulls data from s3 first then returns matches on the day
        //#endregion get data by equipmentID

        //#region get data by phoneNumber
        if (actionType.toLowerCase() == 'getdatabyphonenumber') {
            //#region check if equip id received from user
            if (typeof event.queryStringParameters.phoneNumber == 'undefined') {
                callback(null, { body: JSON.stringify({ "success": false, "errorMessage": 'phoneNumber is undefined' }), "statusCode": 200 });
                return;
            }
            if (event.queryStringParameters.phoneNumber.length == 0) {
                callback(null, { body: JSON.stringify({ "success": false, "errorMessage": 'Invalid phone number' }), "statusCode": 200 });
                return;
            }

            let eqType = '';
            if (typeof event.queryStringParameters.type != 'undefined' && event.queryStringParameters.type.length > 0) { eqType = event.queryStringParameters.type.trim() };
            //#endregion check if equip id received from user

            const phoneNumber = event.queryStringParameters.phoneNumber.trim();
            console.log(`===================IBTgetDATA started the processing of action ${actionType} for phoneNumber : ${phoneNumber}`);

            //#region get employees from db
            action = 'getEmployeeByPhoneNumber';
            let emp = await to(getEmployees(action, phoneNumber));
            //^Getting db/api data in aids
            if (emp[0] != null) {
                console.log("***Error on getting employeesDetails from database - database 1:")
                console.log(emp[0]);
                console.log("===================Exit the function because the details about employees from database - database couldn't be got");
                callback(null, { body: JSON.stringify({ "success": false, "errorMessage": emp[0] }), "statusCode": 200 });
                return;
            }

            let employeesDetails = {};
            if (emp[1] != null) {
                if (!emp[1].success) {
                    console.log("***Error on getting employeesDetails from database - database 2:")
                    console.log(emp[1].errorMessage);
                    console.log("===================Exit the function because the details about employees from database - database couldn't be got");
                    callback(null, { body: JSON.stringify({ "success": false, "errorMessage": emp[1].errorMessage }), "statusCode": 200 });
                    return;
                }
                if (emp[1].success) {
                    employeesDetails = emp[1].data;
                }
            }
            const selectedEmployeeDB = employeesDetails[0];
            //#endregion get employees from db

            //#region get files from s3
            const promiseForEquipDispatches = createPromiseDownloadDispatchData('equipAssignment', currentDayTimestamp);
            const promiseForEemployeeDispatches = createPromiseDownloadDispatchData('employeeAssignment', currentDayTimestamp);

            const [responseError, responseData] = await to(Promise.all([promiseForEquipDispatches, promiseForEemployeeDispatches]));

            if (responseError != null) {
                console.log("***Error on getting files from S3")
                console.log(responseError);
                console.log("===================Exit the function because the files counldn't be got from S3 for Day: " + currentDayTimestamp);
                callback(null, { body: JSON.stringify({ "success": false, "errorMessage": responseError }), "statusCode": 200 });
                return;
            }
            //#endregion get files from s3

            let dataSelected = [];
            let dataSelectedConcat = { equipList: [] };
            let equipAssignment = {};
            let employeeAssignment = {};

            if (responseData != null) {
                for (let i = 0; i < responseData.length; i++) {
                    const response = responseData[i];
                    if (response.success) {
                        if (response.filename == 'equipAssignment') {
                            equipAssignment = response.data.Equips;
                        }
                        if (response.filename == "employeeAssignment") {
                            employeeAssignment = response.data.Employees;
                        }
                    }
                    if (!response.success && response.filename == "employeeAssignment") {
                        console.log("***The process of IBTgetDATA has finished successfully");
                        callback(null, { body: JSON.stringify({ "success": true, "data": { "phoneNumber": phoneNumber, "jobNumber": 'NA' } }), "statusCode": 200 });
                        return;
                    }
                }

                const selectedDispatchEmployee = employeeAssignment.filter(e => e.HCSSIDEmployee == selectedEmployeeDB.HcssId && (e.IUDAction == 'U' || e.IUDAction == 'I'));
                if (typeof selectedDispatchEmployee[0] == 'undefined' || selectedDispatchEmployee.length == 0) {
                    console.log("***The process of IBTgetDATA has finished unsuccessfully");
                    callback(null, { body: JSON.stringify({ "success": true, "data": { "phoneNumber": phoneNumber, "jobNumber": 'NA' } }), "statusCode": 200 });
                    return;
                }

                //#region MULTIPLE OBJECTS WHEN DOUBLE ASSIGNMENT
                for (let i = 0; i < selectedDispatchEmployee.length; i++) {
                    //#region Assignment Data
                    let obj = { equipList: [] };
                    obj.HCSSIDEmployee = selectedEmployeeDB.HcssId.toString();
                    obj.FullName = (typeof selectedEmployeeDB != 'undefined' ? selectedEmployeeDB.EmployeeFirstName + ", " + selectedEmployeeDB.EmployeeLastName : '')
                    obj.PhoneNumber = phoneNumber;
                    obj.jobNumber = selectedDispatchEmployee[i].jobNumber;
                    obj.startDateTimestamp = selectedDispatchEmployee[i].startDateTimestamp;
                    //#endregion Assignment Data

                    //#region Assignment Equip Data
                    let selectedDispatchEquipments = [];
                    if (Object.keys(equipAssignment).length != 0) {
                        selectedDispatchEquipments = equipAssignment.filter(d => d.moveTo == selectedDispatchEmployee[i].jobNumber && (d.IUDAction == 'U' || d.IUDAction == 'I'))
                    }

                    let equipNotes = [];
                    if (selectedDispatchEquipments.length != 0) {
                        let whereEquips = "(";
                        for (let d = 0; d < selectedDispatchEquipments.length; d++) {
                            if (d == 0) {
                                whereEquips = whereEquips.concat("'" + selectedDispatchEquipments[d].equip.replace("'","''").toString() + "'");
                            } else {
                                whereEquips = whereEquips.concat(",'" + selectedDispatchEquipments[d].equip.replace("'","''").toString() + "'");
                            }
                        }
                        whereEquips = whereEquips.concat(")");

                        let query = `select eq.equip, eq.name, eq.category, tp.description from ${database}.${table1} eq left join ${database}.${table2} tp on eq.category = tp.type where equip in ${whereEquips}`
                        //Gets that information for equiplist whereEquips -> ('EQ1','EQ2','EQ3')
                        const [athenaError, athenaData] = await to(athenaExpress.query(query));

                        if (athenaError != null) {
                            console.log("***Error on querying athena 1:")
                            console.log(athenaError);
                            console.log("===================Exit the function because the details of the query through athena couldn't be got");
                            callback(null, { body: JSON.stringify({ "success": false, "errorMessage": "Athena couldn't get data" }), "statusCode": 200 });
                            return;
                        }

                        equipNotes = athenaData.Items;

                        //#region put Equip Data into obj
                        let index = 0;
                        for (let e = 0; e < selectedDispatchEquipments.length; e++) {
                            if (typeof eqType != 'undefined' && eqType.length > 0 && eqType.toLowerCase() == 'rental') {
                                if (selectedDispatchEquipments[e].equip.length == 6) {
                                    obj.equipList[index] = {};
                                    obj.equipList[index].equip = selectedDispatchEquipments[e].equip;
                                    for (let n = 0; n < equipNotes.length; n++) {
                                        if (selectedDispatchEquipments[e].equip == equipNotes[n].equip) {
                                            obj.equipList[index].attachTo = (typeof selectedDispatchEquipments[e].attachTo != 'undefined' ? selectedDispatchEquipments[e].attachTo : '');
                                            obj.equipList[index].name = (typeof equipNotes[n].name != 'undefined' ? equipNotes[n].name : '');
                                            obj.equipList[index].category = (typeof equipNotes[n].category != 'undefined' ? equipNotes[n].category : '');
                                            obj.equipList[index].categoryName = (typeof equipNotes[n].description != 'undefined' ? equipNotes[n].description : '');
                                        };
                                    };
                                    index++;
                                };
                            } else {//if (typeof selectedDispatchEquipments[e].attachTo == 'undefined' || selectedDispatchEquipments[e].attachTo == '') {
                                obj.equipList[index] = {};
                                obj.equipList[index].equip = selectedDispatchEquipments[e].equip;
                                for (let n = 0; n < equipNotes.length; n++) {
                                    if (selectedDispatchEquipments[e].equip == equipNotes[n].equip) {
                                        obj.equipList[index].attachTo = (typeof selectedDispatchEquipments[e].attachTo != 'undefined' ? selectedDispatchEquipments[e].attachTo : '');
                                        obj.equipList[index].name = (typeof equipNotes[n].name != 'undefined' ? equipNotes[n].name : '');
                                        obj.equipList[index].category = (typeof equipNotes[n].category != 'undefined' ? equipNotes[n].category : '');
                                        obj.equipList[index].categoryName = (typeof equipNotes[n].description != 'undefined' ? equipNotes[n].description : '');
                                    };
                                };
                                index++;
                            };
                        };
                        //#endregion put Equip Data into obj
                    }
                    dataSelected.push(obj);
                    //#endregion Assignment Equip Data
                };
                //#endregion MULTIPLE OBJECTS WHEN DOUBLE ASSIGNMENT REGION

                //THIS CODE IS ADDED IN ORDER TO CONCAT THE JOBNUMBERS AND TO GROUP THE EQUIPMENT LISTS WHEN THERE ARE 2 ASSIGNEMENTS (WORKS WITH ONLY 1 ASSIGNEMENT TOO)
                //#region CONCAT REGION
                for (let i = 0; i < dataSelected.length; i++) {
                    dataSelectedConcat.HCSSIDEmployee = (typeof dataSelectedConcat.HCSSIDEmployee == 'undefined' ? dataSelected[i].HCSSIDEmployee : dataSelectedConcat.HCSSIDEmployee);
                    dataSelectedConcat.FullName = (typeof dataSelectedConcat.FullName == 'undefined' ? dataSelected[i].FullName : dataSelectedConcat.FullName);
                    dataSelectedConcat.PhoneNumber = (typeof dataSelectedConcat.PhoneNumber == 'undefined' ? dataSelected[i].PhoneNumber : dataSelectedConcat.PhoneNumber);
                    dataSelectedConcat.jobNumber = (typeof dataSelectedConcat.jobNumber == 'undefined' ? dataSelected[i].jobNumber : dataSelectedConcat.jobNumber.concat(' ' + dataSelected[i].jobNumber));
                    dataSelectedConcat.startDateTimestamp = (typeof dataSelectedConcat.startDateTimestamp == 'undefined' ? dataSelected[i].startDateTimestamp : dataSelectedConcat.startDateTimestamp);
                    for (let l = 0; l < dataSelected[i].equipList.length; l++) {
                        dataSelectedConcat.equipList.push(dataSelected[i].equipList[l]);
                    }
                }
                //#endregion CONCAT REGION

                //THIS CODE IS RETURNING 2 OBJECTS WHEN SOMEONE IS ASSIGNED TWICE
                //WE MAY RETURN TO THIS CODE WHEN IT WILL BE REQUESTED TO
                // callback(null, { body: JSON.stringify({ "success": true, "data": dataSelected }), "statusCode": 200 });

                callback(null, { body: JSON.stringify({ "success": true, "data": dataSelectedConcat }), "statusCode": 200 });
                return;
            };

            //responseData is null
            callback(null, { body: JSON.stringify({ "success": false, "errorMessage": 'responseData from S3 is null' }), "statusCode": 200 });
            return;
        }
        //#endregion get data by phoneNumber

        //#region getEquipData
        if (actionType.toLowerCase() == 'getequipdata') {
            //#region check if equip id received from user
            if (typeof event.queryStringParameters.equipID == 'undefined') {
                callback(null, { body: JSON.stringify({ "success": false, "errorMessage": 'equipID is undefined' }), "statusCode": 200 });
                return;
            }
            if (event.queryStringParameters.equipID.length == 0) {
                callback(null, { body: JSON.stringify({ "success": false, "errorMessage": 'Invalid equipment ID' }), "statusCode": 200 });
                return;
            }
            //#endregion check if equip id received from user

            const equipID = event.queryStringParameters.equipID.trim();
            console.log(`===================IBTgetDATA started the processing of action ${actionType}for equipment id : ${equipID}`);

            let query = `select eq.equip, eq.name, eq.type, eq.category, tp.description, eq.status, eq.jobnumber, eq.note, eq.rentalnote from ${database}.${table1} eq left join ${database}.${table2} tp on eq.category = tp.type where equip = '${equipID}'`

            const [athenaError, athenaData] = await to(athenaExpress.query(query));

            if (athenaError != null) {
                console.log("***Error on querying athena 1:")
                console.log(athenaError);
                console.log("===================Exit the function because the details of the query through athena couldn't be got");
                callback(null, { body: JSON.stringify({ "success": false, "errorMessage": "Athena couldn't get data" }), "statusCode": 200 });
                return;
            }

            if (athenaData.Items.length == 0) {
                callback(null, { body: JSON.stringify({ "success": false, "errorMessage": "Equipment data not found" }), "statusCode": 200 });
                return;
            }

            const selectedEquip = athenaData.Items[0];

            let equipData = {};
            equipData.equip = (typeof selectedEquip.equip != 'undefined' ? selectedEquip.equip : '');
            equipData.name = (typeof selectedEquip.name != 'undefined' ? selectedEquip.name : '');
            equipData.type = (typeof selectedEquip.type != 'undefined' ? selectedEquip.type : '');
            equipData.category = (typeof selectedEquip.category != 'undefined' ? selectedEquip.category : '');
            equipData.description = (typeof selectedEquip.description != 'undefined' ? selectedEquip.description : '');
            equipData.status = (typeof selectedEquip.status != 'undefined' ? selectedEquip.status : '');
            equipData.jobNumber = (typeof selectedEquip.jobnumber != 'undefined' ? selectedEquip.jobnumber : '');
            equipData.note = (typeof selectedEquip.note != 'undefined' ? selectedEquip.note : '');
            equipData.rentalNote = (typeof selectedEquip.rentalnote != 'undefined' ? selectedEquip.rentalnote : '');

            callback(null, { body: JSON.stringify({ "success": true, "data": equipData }), "statusCode": 200 });
            return;
        }
        //#endregion getEquipData

        console.log("***The process of IBTgetDATA has finished unsuccessfully");
        callback(null, { body: JSON.stringify({ "success": false, "errorMessage": 'Invalid action' }), "statusCode": 200 });
        return;
    }

    console.log("***The process of IBTgetDATA has finished unsuccessfully");
    callback(null, { body: JSON.stringify({ "success": false, "errorMessage": 'action is undefined' }), "statusCode": 200 });
};

function createPromiseDownloadTypes(category) {
    return new Promise(async (resolve, reject) => {
        var locationForEquipNote = {
            Bucket: config.aidsS3Bucket,
            Key: "SMS/Types/byType/" + category + ".json"
        };

        const [error, data] = await to(s3.getObject(locationForEquipNote).promise());

        if (error != null) { resolve({ success: false, errorMessage: error, key: locationForEquipNote.Key }); return; };
        if (data != null) { resolve({ success: true, data: JSON.parse(data.Body.toString()), key: locationForEquipNote.Key }); return; }
    });
}

function createPromiseDownloadEquip(equipment) {
    return new Promise(async (resolve, reject) => {
        var locationForEquipNote = {
            Bucket: config.aidsS3Bucket,
            Key: "SMS/EquipmentNotes/" + equipment + ".json"
        };

        const [error, data] = await to(s3.getObject(locationForEquipNote).promise());

        if (error != null) { resolve({ success: false, errorMessage: error, key: locationForEquipNote.Key }); return; };
        if (data != null) { resolve({ success: true, data: JSON.parse(data.Body.toString()), key: locationForEquipNote.Key }); return; }
    });
}

function createPromiseDownloadDispatchData(filename, timestamp) {
    return new Promise(async (resolve, reject) => {
        var locationForData = {
            Bucket: config.aidsS3Bucket,
            Key: "dispatch/incomingV2/" + timestamp + "/" + filename + ".json"
        };

        const [error, data] = await to(s3.getObject(locationForData).promise());

        if (error != null) { resolve({ success: false, filename: filename, errorMessage: error, key: locationForData.Key }); return; };
        if (data != null) { resolve({ success: true, filename: filename, data: JSON.parse(data.Body.toString()), key: locationForData.Key }); return; }
    });
}

async function getEmployees(action, param) {
    // #region get employeesDetails from the database - database
    const APIConfigEmployees = {
        invokeUrl: config.databaseLayer,
        accessKey: config.accessKeyId,
        secretKey: config.secretAccessKey,
        region: 'us-west-2'
    };

    const apigClientEmployees = apigClientFactory.newClient(APIConfigEmployees);
    const methodEmployees = 'GET';

    let additionalParamsEmployees = {};
    if (action == 'getEntireTable') {
        additionalParamsEmployees = {
            queryParams: {
                action: action,
                table: 'HcssEmployeesDirectory'
            }
        };
    }
    else if (action == 'getEmployeeByHcssId') {
        additionalParamsEmployees = {
            queryParams: {
                action: action,
                table: 'HcssEmployeesDirectory',
                hcssId: param
            }
        };
    } else if (action == 'getEmployeeByPhoneNumber') {
        additionalParamsEmployees = {
            queryParams: {
                action: action,
                table: 'HcssEmployeesDirectory',
                phoneNumber: param
            }
        };
    }

    const pathParamsEmployees = {};
    const pathTemplateEmployees = config.databaseLayerPathTemplate;
    const bodyAPIEmployees = {};

    const employeesResponse = await to(apigClientEmployees.invokeApi(pathParamsEmployees, pathTemplateEmployees, methodEmployees, additionalParamsEmployees, bodyAPIEmployees));

    if (employeesResponse[0] != null) {
        return employeesResponse[0];
    }

    if (employeesResponse[1].data != null) {
        return employeesResponse[1].data;
    } else { return; }
    // #endregion
}