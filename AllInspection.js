import { Auth } from "aws-amplify";
import React, { useState, useEffect } from "react";
import ListGroup from "react-bootstrap/ListGroup";
import { BsPencilSquare } from "react-icons/bs";
import { LinkContainer } from "react-router-bootstrap";
import { useAppContext } from "../libs/contextLib";
import LoaderButton from "../components/LoaderButton";
import { onError } from "../libs/errorLib";
import { cleanInspectionList, sortDataBySubject, dataFilterCustom } from "../libs/dataFilterLib";
import { loadDailySchedule, loadAllInspectionTemplates, deleteScheduledInspection } from "../libs/apiLib";
import Accordion from "react-bootstrap/Accordion";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Badge from "react-bootstrap/Badge";
import BranchFilters from '../components/BranchFilters';
import Searchbar from '../components/Searchbar';
import { useHistory } from "react-router-dom";
import "./Home.css";
import { checkCognitoGroups } from "../libs/awsLib";
import { Form } from 'react-bootstrap';

export default function AllInspections() {  
    const history = useHistory();
    const [notes, setNotes] = useState([]);
    // const [defaultNotes, setDefaultNotes] = useState([]);
    const [defaultFilterData, setDefaultFilterData] = useState([]);
    const [schedule, setSchedule] = useState([]);
    const { branchSelection, loading } = useAppContext();
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    // const testEnv = process.env.REACT_APP_STAGE === 'prod' ? true  : false;

    useEffect(() => {
        async function onLoad() {
            try {
                const notes = await loadAllInspectionTemplates();
                const schedule = await loadDailySchedule();
                const sortedSchedules = sortDataBySubject("branch", schedule);
                const updatedNotes = cleanInspectionList(notes, branchSelection);
                updatedNotes.sort((a, b) => a.description.localeCompare(b.description));
                setNotes(updatedNotes);
                setSchedule(sortedSchedules);
                setDefaultFilterData([updatedNotes, sortedSchedules]);
                const adminCheck= await checkCognitoGroups();
                setIsAdmin(adminCheck);
            } catch (e) {
                onError(e);
            }

            setIsLoading(false);
        }

        onLoad();
    }, [branchSelection]);


  const [isOpen, setIsOpen] = useState([]);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [inputValue, setInputValue] = useState('');

  const options = [
    { value: 'Short of manpower', label: 'Short of manpower' },
    { value: 'Low priority', label: 'Low priority' },
    { value: 'Duplicate inspection', label: 'Duplicate inspection' },
    { value: 'Inadequate time', label: 'Inadequate time' },
    { value: 'Lack tools & parts ', label: 'Lack tools & parts' },
    { value: 'EQ still in repair', label: 'EQ still in repair' },
    { value: 'Plant shutdown', label: 'Plant shutdown' },
    { value: 'Other:', label: 'Other:' },
  ];

  const handleOptionToggle = (e,optionValue) => {
    e.stopPropagation();

    const index = selectedOptions.indexOf(optionValue);
    if (index > -1) {
      setSelectedOptions([...selectedOptions.slice(0, index), ...selectedOptions.slice(index + 1)]);
    } else {
      setSelectedOptions([...selectedOptions, optionValue]);
    }
  };

  const handleInputChange = (event) => {
    event.stopPropagation();
    setInputValue(event.target.value);
  };

  const handleSubmit = (event) => {
    event.stopPropagation();
    console.log('Selected options:', selectedOptions);
    console.log('Input value:', inputValue);
  };

    function compare(a, b) {
        const descriptionA = a.description.toUpperCase();
        const descriptionB = b.description.toUpperCase();

        let comparison = 0;
        if (descriptionA > descriptionB) {
            comparison = 1;
        } else if (descriptionA < descriptionB) {
            comparison = -1;
        }
        return comparison;
    }

    useEffect(()=>{
        const array = [];
        for (let index = 0; index < notes.length; index++) {
            
           array.push(false) 
        }
        setIsOpen(array)
    }, [notes])

    async function handleDelete(e,index) {
        e.stopPropagation();

        console.log("asdas ",index);

        const array = [...isOpen];
        
        array[index] = !array[index]

        setIsOpen(array)
        
        
    }

    async function handleRedirect(e, dayAtMidPst, eqID, branch) {
        e.stopPropagation();
        let daysAtMidPstForCurrentEqID = [];

        if (dayAtMidPst == 0) {
            console.log(schedule.filter(branches => branches.branch == branch))
            const selectedSchedule = schedule.filter(branches => branches.branch == branch);

            if (selectedSchedule.length > 0) {
                const selectedInspections = selectedSchedule[0].inspections;
                daysAtMidPstForCurrentEqID = selectedInspections.filter(inspections => inspections.eqID == eqID);
            }

            localStorage.setItem('selectedEqIDDetails', JSON.stringify({"eqIDDetails": daysAtMidPstForCurrentEqID}));
        }
        
        history.push(`/inspections/${encodeURIComponent(eqID).replace(/\*/g, "%2A")}/${dayAtMidPst}`)
    }

    function setData (data) {
        const notes = data[0];
        const schedules = data[1];

        setNotes(notes);
        setSchedule(schedules);
    }

    function renderSchedule(schedule) {
        return (
            <>
                <h2>Scheduled Inspections</h2>
                <Accordion>
                    {schedule.map((data, index) => (
                        <Card key={`scheduleCard-${index}`}>
                            <Card.Header>
                                <Accordion.Toggle as={Button} variant="link" eventKey={`${index}`}>
                                    Branch {data.branch} <Badge variant="info">{data.inspections.length}</Badge>
                                </Accordion.Toggle>
                            </Card.Header>
                            <Accordion.Collapse eventKey={`${index}`}>
                                <Card.Body>
                                    {renderInspectionList(data.inspections, "scheduled")}
                                </Card.Body>
                            </Accordion.Collapse>
                        </Card>
                    ))}
                </Accordion>
            </>
        )
    }
    
    function renderInspectionList(notes, use) {
        return (
            <>
                {notes.map(({ eqID, branch, description, createdAt, dayAtMidPst }, index) => (
                    (eqID !== "Truck") ? (
                        <LinkContainer key={`${use}-${eqID}-${index}`} to={`#-${index}`} onClick={(e) => handleRedirect(e, use == "scheduled" ? dayAtMidPst : 0, eqID, branch)}>
                            <ListGroup.Item action>
                                
                                <span className="font-weight-bold">
                                    {eqID}-{description}
                                </span>
                                <br />
                                <span className="text-muted">
                                    Created: {new Date(createdAt).toLocaleString()}
                                </span>
                                {use == "scheduled"
                                    && <div>
                                    <Button variant="primary" onClick={(e) => handleDelete(e,index)}>
                                       Scheduled Inspection Not Completed 1
                                    </Button>
                                    {isOpen[index] && (
                                      <div className="border:0">
                                        
                                        <Form  onSubmit={handleSubmit}>
                                        <Form.Label>Reasons</Form.Label>
                                          {options.map((option) => (
                                            <Form.Check
                                              key={option.value}
                                              type="checkbox"
                                              label={option.label}
                                              value={option.value}
                                              checked={selectedOptions.includes(option.value)}
                                              onChange={(e) => handleOptionToggle(e,option.value)}
                                            />
                                          ))}
                                          <Form.Group controlId="inputValue">
                                            <Form.Label>Comments:</Form.Label>
                                            <Form.Control type="text" value={inputValue} onChange={handleInputChange} />
                                          </Form.Group>
                                          <Button type="submit">Submit</Button>
                                        </Form>
                                      </div>
                                    )}
                                  </div>}
                            </ListGroup.Item>
                        </LinkContainer>
                    ) : (
                        <LinkContainer key={`${use}-${eqID}-${index}`} to={`/dvcr`}>
                            <ListGroup.Item action>
                                <span className="font-weight-bold">
                                    {eqID}-{description}
                                </span>
                                <br />
                                <span className="text-muted">
                                    Created: {new Date(createdAt).toLocaleString()}
                                </span>
                                {use == "scheduled"
                                    && <div>
                                    <Button variant="primary" onClick={(e) => handleDelete(e,index)}>
                                       Scheduled Inspection Not Completed 2
                                    </Button> 
                                    {isOpen[index] && (
                                      <div className="border:0">
                                        
                                        <Form  onSubmit={handleSubmit}>
                                        <Form.Label>Reasons</Form.Label>
                                          {options.map((option) => (
                                            <Form.Check
                                              key={option.value}
                                              type="checkbox"
                                              label={option.label}
                                              value={option.value}
                                              checked={selectedOptions.includes(option.value)}
                                              onChange={(e) => handleOptionToggle(e,option.value)}
                                            />
                                          ))}
                                          <Form.Group controlId="inputValue">
                                            <Form.Label>Comments:</Form.Label>
                                            <Form.Control type="text" value={inputValue} onChange={handleInputChange} />
                                          </Form.Group>
                                          <Button type="submit">Submit</Button>
                                        </Form>
                                      </div>
                                    )}
                                  </div>}
                            </ListGroup.Item>
                        </LinkContainer>
                    )
                ))}
            </>
        );
    }


    function catSelect(categories){

    }

    function renderNotesList(notes) {
        return (
            <>
                {!loading &&  <BranchFilters onSelect={catSelect}/>}
                <Searchbar
                    dataFilter={dataFilterCustom}
                    setData={setData}
                    placeholder={"Search Equipment (Schedules/Inspections), Category (Inspections), or Description (Schedules/Inspections)"}
                    defaultList={defaultFilterData}
                    key={defaultFilterData}
                />
                <LinkContainer to="/formcreator">
                    <ListGroup.Item action className="py-3 text-nowrap text-truncate">
                        <BsPencilSquare size={17} />
                        <span className="ml-2 font-weight-bold">Perform a new inspection</span>
                    </ListGroup.Item>
                </LinkContainer>
                {renderInspectionList(notes, "all")}
            </>
        );
    }

    // function renderLander() {
    //     return (
    //         <div className="lander">
    //             <h1>Branch Hub</h1>
    //             <p className="text-muted">A simple inspection demo app</p>
    //         </div>
    //     );
    // }

    function renderNotes() {
        return (
            <div className="notes">
                {schedule.length > 0 && renderSchedule(schedule)}
                <h2 className="pb-3 mt-4 mb-3 border-bottom">Inspections on Demand</h2>
                <ListGroup>{!isLoading && renderNotesList(notes)}</ListGroup>
            </div>
        );
    }

    return (
        <div className="Home">
            {/* {isAuthenticated ? renderNotes() : renderLander()} */}
            {renderNotes()}
        </div>
    );
}