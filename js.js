import React, { useState, useEffect } from "react";
import ListGroup from "react-bootstrap/ListGroup";
import { useAppContext } from "../libs/contextLib";
import { onError } from "../libs/errorLib";
import { s3Link } from "../libs/awsLib";
import Tabs from "react-bootstrap/Tabs";
import Tab from "react-bootstrap/Tab";
import "./Home.css";
import "flatpickr/dist/themes/material_green.css";
import { Nav, Col, Row, Accordion, Card, Button } from "react-bootstrap";
import Photolink from '../components/photolink';
import BranchFilters from '../components/BranchFilters';
import { cleanInspectionList, sortDataBySubject,dataFilter, dataFilterHistory } from "../libs/dataFilterLib";
import { loadHistory } from "../libs/apiLib";
import Searchbar from '../components/Searchbar';


export default function ScheduleInspection() {
    const [notes, setNotes] = useState([]);
    const [defaultHistory, setDefaultHistory] = useState([]);
    const { isAuthenticated, branchSelection } = useAppContext();
    const [isLoading, setIsLoading] = useState(true);
    const [issueKey, setIssueKey] = useState();
    //const today=dayjs().tz("America/Los_Angeles").format("YYYY-MM-DD");


    useEffect(() => {
        async function onLoad() {
            if (!isAuthenticated) {
                return;
            }

            try {
                const notes = await loadHistory();
                //console.log(notes);
                //download all the inpsections
                const updatedNotes= cleanInspectionList(notes, branchSelection);
                //console.log("***");
                //console.log(updatedNotes);
                //filter by branch selection (could be done at various pages)
                const sortedInspections= sortDataBySubject("eqID",updatedNotes);
                //An alternative may be to sort by eq-> gather all inspectionInfo-> Then sort by cate/Questions
                setIssueKey(0);
                //console.log("Before transformed:");
                console.log(sortedInspections);
                const altObj=await prepareDataForAltView(sortedInspections);
                //Need to figure out what this is, we will want to show comments in addition to the categories
                //console.log("Transformed obj");
               

                altObj.sort(function(a, b) {
                    var textA = a.extraNotes[0].description.toUpperCase();
                    var textB = b.extraNotes[0].description.toUpperCase();
                    return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
                });

                console.log("***",altObj);
                setDefaultHistory(altObj);
                setNotes(altObj);
                //setNotes(sortedInspections);
            } catch (e) {
                onError(e);
            }

            setIsLoading(false);
        }

        onLoad();
    }, [isAuthenticated, branchSelection]);



    function altHistory(notes) {
        return (
            <>
                <Tabs
                    id="controlled-tab-example"
                    activeKey={issueKey}
                    onSelect={(k) => {setIssueKey(k);}}
                    style={{flexDirection:"column"}}
                    className="history-tab"
                   
                >
                    {
                        notes.map((data, index) => (
                            <Tab eventKey={index} title={data.extraNotes[0].description +"("+ data.eqID+")"} key={index} selectedTabClassName="border border-solid">
                                <Tab.Container id="left-tabs-example" defaultActiveKey="0">
                                    <Row>
                                        <Col sm={3}>
                                            <Nav variant="pills" className="flex-column" >
                                                {notes[index].sortedInfo.map((d,idx) => (
                                                    <Nav.Item>
                                                        <Nav.Link eventKey={`${idx}`}>{d.cateName}</Nav.Link>
                                                    </Nav.Item>
                                                ))}
                                                <Nav.Item>
                                                    <Nav.Link eventKey={`comments-${index}`}>Extra Notes</Nav.Link>
                                                </Nav.Item>
                                            </Nav>
                                        </Col>
                                        <Col sm={9}>
                                            <Tab.Content>
                                                {data.sortedInfo.map((d,idx) => (
                                                    <Tab.Pane eventKey={`${idx}`} >
                                                        <Accordion>
                                                            {d.allData.map((d2,i2) => (
                                                                <Card>
                                                                    <Card.Header>
                                                                        <Accordion.Toggle as={Button} variant="link" eventKey={`${i2}`}>
                                                                            {d2.question}
                                                                        </Accordion.Toggle>
                                                                    </Card.Header>
                                                                    <Accordion.Collapse eventKey={`${i2}`}>
                                                                        <Card.Body>
                                                                            {d2.payload.map((d3,i3) => (
                                                                                <ListGroup.Item key={`payload--${i2}-${i3}`}>
                                                                                    <span className="font-weight-bold">
                                                                                        {d3.fullData.value}
                                                                                    </span>
                                                                                    <br/>
                                                                                    <span className="text-muted">
                                                                                        Certifier: {d3.certifier}
                                                                                    </span>
                                                                                    {
                                                                                        d3.taskDuration && (
                                                                                            <>
                                                                                                <br />
                                                                                                <span className="text-muted">
                                                                                                    Task Duration: {d3.taskDuration} (Hours)
                                                                                                </span>
                                                                                            </>
                                                                                        )
                                                                                    }
                                                                                    {
                                                                                        d3.truckData.mileage && (
                                                                                            <>
                                                                                                <br />
                                                                                                <span className="text-muted">
                                                                                                    Mileage: {d3.truckData.mileage}
                                                                                                </span>
                                                                                                <br />
                                                                                                <span className="text-muted">
                                                                                                    Hours: {d3.truckData.truckhours}
                                                                                                </span>
                                                                                                <br />
                                                                                                <span className="text-muted">
                                                                                                    Tare Weight: {d3.truckData.tareweight}
                                                                                                </span>
                                                                                                <br />
                                                                                                <span className="text-muted">
                                                                                                    Pre or Post: {d3.truckData.prepost}
                                                                                                </span>
                                                                                                <br />
                                                                                                <span className="text-muted">
                                                                                                    Satisfactory Conidition: {d3.truckData.truckCondition}
                                                                                                </span>
                                                                                            </>
                                                                                        )
                                                                                    }
                                                                                    <br />
                                                                                    <span className="text-muted">
                                                                                        Submitted At: {new Date(d3.createdAt).toLocaleString()}
                                                                                    </span>
                                                                                    {
                                                                                        d3.fullData.comment.length > 0 && (
                                                                                            <>
                                                                                                <br/>
                                                                                                <span className="text-muted">
                                                                                                    Comment: {d3.fullData.comment}
                                                                                                </span>
                                                                                            </>
                                                                                        )
                                                                                    }
                                                                                    <Photolink
                                                                                        photo={d3.fullData.photo}
                                                                                        photoUrl={d3.fullData.photoUrl}
                                                                                    />
                                                                                    <Photolink
                                                                                        photo={d3.fullData.photoTwo}
                                                                                        photoUrl={d3.fullData.photoTwoUrl}
                                                                                    />
                                                                                    {
                                                                                        d3.fullData.FixedTimestamp > 0 && (
                                                                                            <>
                                                                                                <br/>
                                                                                                <span className="text-muted">
                                                                                                    Fixed By: {d3.fullData.FixedBy}
                                                                                                </span>
                                                                                                <br/>
                                                                                                <span className="text-muted">
                                                                                                    Fixed Comment: {d3.fullData.FixComment}
                                                                                                </span>
                                                                                                <br/>
                                                                                                <span className="text-muted">
                                                                                                    Fixed on: {new Date(d3.fullData.FixedTimestamp).toLocaleString()}
                                                                                                </span>
                                                                                            </>
                                                                                        )
                                                                                    }

                                                                                    
                                                                                </ListGroup.Item>
                                                                            ))}
                                                                        </Card.Body>
                                                                    </Accordion.Collapse>
                                                                </Card>
                                                            ))}
                                                        </Accordion>
                                                    </Tab.Pane>
                                                ))}
                                                {/* Add in the extraNotes here */}
                                                <Tab.Pane eventKey={`comments-${index}`}>
                                                        <Accordion>
                                                            <Card>
                                                                <Card.Header>
                                                                    <Accordion.Toggle as={Button} variant="link" eventKey={`comments A T-${index}`}>
                                                                        Remarks/Notes
                                                                    </Accordion.Toggle>
                                                                </Card.Header>
                                                                <Accordion.Collapse eventKey={`comments A T-${index}`}>
                                                                    <Card.Body>
                                                                        {data.extraNotes.map((d2,i2) => (
                                                                            <ListGroup.Item key={`extranotes--${index}-${i2}`}>
                                                                                                                                           
                                                                                {
                                                                                    (d2.extraNotes.comment.length > 0 || (d2.extraNotes.photo)) && (
                                                                                        <>
                                                                                            <span className="font-weight-bold">
                                                                                                Comments and Photos
                                                                                            </span>
                                                                                            <br/>
                                                                                            <span className="text-muted">
                                                                                                Certifier: {d2.certifier}
                                                                                            </span>
                                                                                            {
                                                                                                d2.taskDuration && (
                                                                                                    <>
                                                                                                        <br/>
                                                                                                        <span className="text-muted">
                                                                                                            Task Duration: {d2.taskDuration} (Hours)
                                                                                                        </span>
                                                                                                    </>
                                                                                                )
                                                                                            }
                                                                                            <br/>
                                                                                            <span className="text-muted">
                                                                                                Submitted At: {new Date(d2.createdAt).toLocaleString()}
                                                                                            </span>
                                                                                            {
                                                                                                d2.truckData.mileage && (
                                                                                                    <>
                                                                                                        <br />
                                                                                                        <span className="text-muted">
                                                                                                            Mileage: {d2.truckData.mileage}
                                                                                                        </span>
                                                                                                        <br />
                                                                                                        <span className="text-muted">
                                                                                                            Hours: {d2.truckData.truckhours}
                                                                                                        </span>
                                                                                                        <br />
                                                                                                        <span className="text-muted">
                                                                                                            Tare Weight: {d2.truckData.tareweight}
                                                                                                        </span>
                                                                                                        <br />
                                                                                                        <span className="text-muted">
                                                                                                            Pre or Post: {d2.truckData.prepost}
                                                                                                        </span>
                                                                                                        <br />
                                                                                                        <span className="text-muted">
                                                                                                            Satisfactory Conidition: {d2.truckData.truckCondition}
                                                                                                        </span>
                                                                                                    </>
                                                                                                )
                                                                                            }
                                                                                            {
                                                                                                d2.extraNotes.comment.length > 0 && (
                                                                                                    <>
                                                                                                        <br/>
                                                                                                        <span className="text-muted">
                                                                                                            Comment: {d2.extraNotes.comment}
                                                                                                        </span>
                                                                                                    </>
                                                                                                )
                                                                                            }
                                                                                            <Photolink
                                                                                                photo={d2.extraNotes.photo}
                                                                                                photoUrl={d2.extraNotes.photoUrl}
                                                                                            />
                                                                                        </>
                                                                                    )
                                                                                }
                                                                                {
                                                                                    d2.extraNotes.FixedTimestamp > 0 && (
                                                                                        <>
                                                                                            <br/>
                                                                                            <span className="text-muted">
                                                                                                Fixed By: {d2.extraNotes.FixedBy}
                                                                                            </span>
                                                                                            <br/>
                                                                                            <span className="text-muted">
                                                                                                Fixed Comment: {d2.extraNotes.FixComment}
                                                                                            </span>
                                                                                            <br/>
                                                                                            <span className="text-muted">
                                                                                                Fixed on: {new Date(d2.extraNotes.FixedTimestamp).toLocaleString()}
                                                                                            </span>
                                                                                        </>
                                                                                    )
                                                                                }

                                                                                
                                                                            </ListGroup.Item>
                                                                        ))}
                                                                    </Card.Body>
                                                                </Accordion.Collapse>
                                                            </Card>
                                                        </Accordion>
                                                </Tab.Pane>
                                            </Tab.Content>
                                        </Col>
                                    </Row>
                                </Tab.Container>
                            </Tab>
                        ))
                    }
                </Tabs>
            </>
        );
    }

    function catSelect(categories){

    }

    function renderNotesList(notes) {
        console.log("notees",notes);
        return (
            <>
                 <BranchFilters onSelect={catSelect}/>
                <Searchbar
                    dataFilter={dataFilterHistory}
                    setData={setNotes}
                    placeholder={"Search Equipment ID or Description"}
                    defaultList={defaultHistory}
                />
                {altHistory(notes)}
            </>
        );
    }

    function renderLander() {
        return (
            <div className="lander">
                <h1>Scratch</h1>
                <p className="text-muted">A simple note taking app</p>
            </div>
        );
    }

    function renderNotes() {
        return (
            <div className="notes">
                <h2 className="pb-3 mt-4 mb-3 border-bottom">Past 90 Days</h2>
                <ListGroup>{!isLoading && renderNotesList(notes)}</ListGroup>
            </div>
        );
    }

    return (
        <div className="Home">
            {isAuthenticated ? renderNotes() : renderLander()}
        </div>
    );
}




export async function prepareDataForAltView(sortedInspections){
    //Iterate through every branchinspection
        //And create individual object? {eqID, createdAt, cate, qText, value, comment, photo, fixed info}
    //Extract the equipment ids into a set
    //Iterate through every equipment ID
    //Filter original branchinspection list to make equipment id
    //sortedInspections already seperated all the inspection into eq and then their inspections
    let masterObj=[];
    for(var i=0;i<sortedInspections.length;i++){
    //sortedInspections.forEach((eqInSet) => {
        const eqInSet=sortedInspections[i];
        //Go through all the inspections to seperate by eq
        let eqCategories=new Set();
        //let questions=new Set();
        let testSet=new Set();
        let cateQset=[];
        let finalCollection=[];
        let cateQuestionpair={};
        let extraNotesCollection=[];
        for(var ii=0;ii<eqInSet.inspections.length;ii++){
        //eqInSet.inspections.forEach((ins) => {
            const ins=eqInSet.inspections[ii];
            //need to go through inspectionInfo
            const truckExtraInfo={mileage: ins.mileage, truckhours: ins.truckhours, tareweight: ins.tareweight, prepost: ins.prepost, truckCondition: ins.truckCondition};
            for(var iii=0;iii<ins.inspectionInfo.length;iii++){
            //ins.inspectionInfo.forEach((cate) => {
                const cate=ins.inspectionInfo[iii];
                //go through the categories
                for(var iv=0;iv<cate.qList.length;iv++){
                //cate.qList.forEach((ques) => {
                    const ques=cate.qList[iv];
                    //May want to check for a photo and download link now
                    eqCategories.add(cate.name);
                    //
                    //questions.add({name: cate.name, question: ques.qText});
                    //
                    cateQuestionpair[ques.qText]=cate.name;
                    testSet.add(ques.qText);
                    //if theres a photo get a link and add it to fulldata
                    if(ques.photo && ques.photo.length >0){
                        //Means there is a photo, use the file path and user id and get a link
                        ques.photoUrl = await s3Link(ques.photo,ins.userId);
                    }
                    if(ques.photoTwo && ques.photoTwo.length >0){
                        //Means there is a photo, use the file path and user id and get a link
                        ques.photoTwoUrl = await s3Link(ques.photoTwo,ins.userId);
                    }
                    
                    cateQset.push({createdAt: ins.createdAt, certifier: ins.certifier, taskDuration: ins.taskDuration, truckData:truckExtraInfo, name: cate.name, question: ques.qText, fullData: ques});
                };
            };
            //Need to go through the extraNotes
            if(ins.extraNotes !== undefined) {
                //if theres a photo get a link and add it to fulldata
                if(ins.extraNotes.photo && ins.extraNotes.photo.length >0){
                    //Means there is a photo, use the file path and user id and get a link
                    ins.extraNotes.photoUrl = await s3Link(ins.extraNotes.photo,ins.userId);
                }
                //const truckExtraInfo={mileage: ins.mileage, truckhours: ins.truckhours, tareweight: ins.tareweight, prepost: ins.prepost, truckCondition: ins.truckCondition};
                extraNotesCollection.push({createdAt:ins.createdAt, certifier: ins.certifier, taskDuration: ins.taskDuration, truckData:truckExtraInfo, extraNotes: ins.extraNotes, description: ins.description});
                //may want to add in some of the secondary attributes
            }
        };
        //At this point you have all the eqCategories, and an object that can be filtered and give you all hte questions
        let eqCatArray=Array.from(eqCategories);
        //let quesArray=Array.from(questions);
        let justquesArray=Array.from(testSet);
        console.log("Categories ",eqCatArray.length);
        //console.log("q's ",quesArray.length);
        console.log("q's 2 ",testSet.size);
        console.log("All q's ",cateQset.length);

        let finalObj=[];
        justquesArray.forEach((q) => {
            //console.log(q);
            let filteredSet=cateQset.filter(x => x.question === q);
            //finalCollection.push({allData: filteredSet, cateName: category, question: q.question});
            let sortedDataSet=filteredSet.sort((a, b) => a.createdAt - b.createdAt).reverse();
            //console.log(`Number of questions=${sortedDataSet.length} for set`);
            //finalObj[q.question]= sortedDataSet;
            finalObj.push({question: q, payload:sortedDataSet, categoryName: cateQuestionpair[q]});
            
        });
        eqCatArray.forEach((category) => {
            //console.log(category);
            let questionSet=finalObj.filter(x => x.categoryName === category);
            //let finalObj=[];

            finalCollection.push({cateName: category, allData: questionSet});
        });
        let sortedExtraNotes=extraNotesCollection.sort((a, b) => a.createdAt - b.createdAt).reverse();
        //console.log(eqInSet.eqID);
        console.log(finalCollection);
        masterObj.push({eqID: eqInSet.eqID, sortedInfo: finalCollection, extraNotes:sortedExtraNotes});
    };

    return masterObj;

    //For each filtered branchinspection object, gather all the inspectionInfo into one array with added createdAt component

    //Iterate through all the inspectionInfo and extract the qText

    //Iterate through all the qText and filter inspectionInfo and sort by date 

    //Use objects to render individual equipment tab
}