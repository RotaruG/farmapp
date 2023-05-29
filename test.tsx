/* eslint-disable react-hooks/exhaustive-deps */
import "./PavingManagement.css";
import { FC, useContext, useEffect, memo, useState, useCallback } from "react";
import React from "react";
import moment from "moment";
import { Maybe, Query, MasterCrewSchedulePaving, ResourceCode, CannedResources, JobInfoFullInput, AddMasterCrewSchedulesPavingInput, MasterCrewSchedule, SuperIntendentPavingCalendar } from "../../graphql/schema-types";
import { TextInput } from "../TextInput";
import { CheckBox } from "../Form/CheckBox";
import { useImmer } from "use-immer";
import { RESOURCE_CODES_QUERY } from "../../graphql/queries/RESOURCE_CODES_QUERY";
import { useApolloClient, useQuery } from "@apollo/react-hooks";
import { ModalContext } from "../Modal/ModalContext/ModalContext";
import { CancelAssignment } from "../Warnings & errors/CancelAssignment/CancelAssignment";
import { TRUCKING_DATAS_QUERY } from "../../graphql/queries/TRUCKING_DATAS_QUERY";
import { addPavingFromPavingManagement, addPavingResourcesToDay, addTruckingQTYFromPaving, addTruckingResourcesToDayFromPavingManagement, clearDay, RemoveJob } from "../../redux/appSlice";
import { useDispatch, useSelector } from "react-redux";
import { TruckingManagement } from "../Trucking/TruckingManagement/TruckingManagement";
import { toMap } from "../../utils/toMap";
import { toMultiMap } from "../../utils/toMultiMap";
import { CloseButton } from "../Form/CloseButton";
import { RootState } from "../../redux/store";
import { CANNED_QUERY } from "../../graphql/queries/CANNED_QUERY";
import { TruckingResourcesNotAllocated } from "../Warnings & errors/ApplyTruckingResources/TruckingResourcesNotAllocated";
import { SelectMultipleDatesPavingManagement } from "./SelectMultipleDatesPavingManagement/SelectMultipleDatesPavingManagement";
import { DATES_PAVING_CALENDAR_QUERY } from "../../graphql/queries/DATES_PAVING_CALENDAR";
import { GeneralWarningModal } from "../Warnings & errors/GeneralWarningModal/GeneralWarningModal";
import { LOAD_OUT_TIME_QUERY } from "../../graphql/queries/LOAD_OUT_TIME_QUERY";
import { SUPER_INTENDENT_PAVING_CALENDAR_QUERY } from "../../graphql/queries/SUPER_INTENDENT_PAVING_CALENDAR_QUERY";
import { FullScreenLoadingIndicator } from "../Modal/LoadingIndicator/FullScreenLoadingIndicator";
import to from "await-to-js";

interface IPavingManagementProps {
  unix: number;
  locationIndex: number
  jobNumber: number;
  pavingResources: Maybe<MasterCrewSchedulePaving>[];
  onApply(value: string | number): void;
  onClose?(): void;
  onAddedFromPaving?(): void;
  indexPosition?: number | null;
}

type State = {
  resources: Maybe<MasterCrewSchedulePaving>[];
  qtySum: number;
  buttonDisabled: boolean;
  cannedCode: string;
  startDate: string;
  endDate: string
};

interface CheckBoxes {
  grinderCheckBox: boolean,
  rtsSupportCheckBox: boolean,
}

const getInitialPavingState = (): MasterCrewSchedulePaving & CheckBoxes => {
  return ({
    material: "",
    mixSubmital: "",
    plant: "",
    tonnage: null,
    oilTruck: null,
    notes: "",
    shift: "",
    qty: null,
    resourceID: "",
    resourceDescription: "",
    resourceType: "",
    tph: null,
    rtsSupport: "",
    bookTruckVendor: "",
    grinder4ft: null,
    grinder6ft: null,
    grinder7ft: null,
    grinder12ft: null,
    extraWork: "N",
    uts: "N",
    mixDesignApproval: "N",
    grinderCheckBox: false,
    rtsSupportCheckBox: true,
    addedFromPaving: false,
    updated: true,
    loadOutTime: "",
    addedDate: "",
  })
}

const PavingManagement: FC<IPavingManagementProps> = props => {

  const dateFormat = "YYYY.MM.DD";

  const generatedDays = useSelector((state: RootState) => state.app.schedule.locations?.[props.locationIndex].days);

  const [state, setState] = useImmer<State>({
    resources: [],
    qtySum: 0,
    buttonDisabled: true,
    cannedCode: "",
    startDate: moment().startOf('month').format(dateFormat),
    endDate: moment().startOf('month').add(3, 'months').format(dateFormat)
  });

  const [pavingState, setPavingState] = useImmer(getInitialPavingState());
  const [selectedDates, setSelectedDates] = useState([moment(props?.unix).utc().format("YYYY.MM.DD")]);
  // const [datesOutOfGeneratedDays, setDatesOutOfGeneratedDays] = useState<string[]>([]);
  // this state is filled when the other location has the same shift
  const [hasSameShift, setSameShift] = useState<boolean>(false);
  const [loadingSave, setLoadingSave] = useState<boolean>(false);

  const { data: datesInPavingCalendar } = useQuery<Pick<Query, "datesInPavingCalendar">>(DATES_PAVING_CALENDAR_QUERY, {
    variables: {
      data: {
        startDate: (moment(state.startDate, "YYYY-MM-DD").unix()) * 1000,
        endDate: (moment(state.endDate, "YYYY-MM-DD").unix()) * 1000
      }
    },
    skip: state.startDate == null || state.startDate === "" || state.endDate == null || state.endDate === "",
    fetchPolicy: "no-cache"
  });

  const {
    loading: lockedDaysLoading, data: lockedDaysData, refetch: refetchLockedDays } = useQuery<Pick<Query, "superIntendentPavingCalendar">>(SUPER_INTENDENT_PAVING_CALENDAR_QUERY, {
      variables: {
        where: {
          startDate: generatedDays?.[0],
          endDate: generatedDays?.[generatedDays.length - 1]
        }
      },
      fetchPolicy: "no-cache",
      skip: generatedDays == null || generatedDays?.length === 0
    });

  const { data: loadOutTimeData } = useQuery<Pick<Query, "loadOutTimeValues">>(LOAD_OUT_TIME_QUERY, { fetchPolicy: "no-cache" });
  const { data } = useQuery<Pick<Query, "resourceCodes">>(RESOURCE_CODES_QUERY);
  const { data: canned } = useQuery<Pick<Query, "canned">>(CANNED_QUERY);
  const { data: trucking } = useQuery<Pick<Query, "truckingDatas">>(TRUCKING_DATAS_QUERY);

  const materials = useSelector((state: RootState) => state.app.materialDatas);
  const truckingResources = useSelector((state: RootState) => state.app.schedule.locations?.[props.locationIndex]?.daysByUnix[props.unix]?.trucking?.truckingResources);
  const pavingResourcesRedux = useSelector((state: RootState) => state.app.schedule.locations?.[props.locationIndex]?.daysByUnix?.[props.unix]?.paving?.pavingResources)
  const days = useSelector((state: RootState) => state.app.schedule.locations?.[props.locationIndex]?.daysByUnix);
  const pavings = Object.values(days).filter(d => d.paving.pavingResources.length > 0);
  const jobNumberInformations = useSelector((state: RootState) => state.app.jobNumberInformations);
  const modal = useContext(ModalContext);
  const pavingResurcesLocation1ForPaving = useSelector((state: RootState) => state.app.schedule.locations?.[1].daysByUnix?.[props.unix]?.paving?.pavingResources);
  const pavingResurcesLocation2ForPaving = useSelector((state: RootState) => state.app.schedule.locations?.[2]?.daysByUnix?.[props.unix]?.paving?.pavingResources);
  const pavingResurcesLocation3ForPaving = useSelector((state: RootState) => state.app.schedule.locations?.[3]?.daysByUnix?.[props.unix]?.paving?.pavingResources);
  const pavingResurcesLocation4ForPaving = useSelector((state: RootState) => state.app.schedule.locations?.[4]?.daysByUnix?.[props.unix]?.paving?.pavingResources);
  const jobNumber = useSelector((state: RootState) => state.app.start.jobNumber);

  const client = useApolloClient();

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.removeAttribute('style')
    }
  }, [])

  useEffect(() => {
    window.onpopstate = (e: any) => {
      props?.onClose?.()
    }
  }, [])

  useEffect(() => {
    if (data == null || data.resourceCodes == null) return;
    if (state.resources.length > 0) return;

    const masterCrewRecourceId = toMap(props.pavingResources, cr => cr?.resourceID ?? "");

    setState(draft => {

      const resourcesByResourceType = toMultiMap(data.resourceCodes.filter(r => r?.ResourceID !== "ACP"), r => r?.ResourceType ?? "");

      const resourcesByResourceCode = toMultiMap(data.resourceCodes.filter(r => r?.ResourceID !== "ACP"), r => r?.ResourceCode ?? "");

      Object.keys(resourcesByResourceType).forEach(key => {
        resourcesByResourceType[key].sort((a, b) => a?.ResourceDescription! < b?.ResourceDescription! ? -1 : 1)
      })
      let resourcesCodes: Maybe<ResourceCode>[] = [];
      resourcesCodes.push(...resourcesByResourceType["Labor"], ...resourcesByResourceCode["Paving Equipment"], ...resourcesByResourceCode["Asphalt Compactors"]);

      draft.resources = resourcesCodes
        .filter(rc => rc?.ResourceID !== "TRK" && rc?.ResourceID !== "PAV")
        .map(rc => (
          {
            date: props.unix,
            jobNumber: props.jobNumber,
            locationIndex: props.locationIndex,
            mixSubmital: "",
            notes: "",
            shift: "",
            searchGSI_JobNumber: props.jobNumber,
            type: "",
            uID: null,
            resourceID: rc?.ResourceID,
            resourceType: rc?.ResourceType,
            resourceDescription: rc?.ResourceDescription,
            qty: masterCrewRecourceId[rc?.ResourceID!] != null ? masterCrewRecourceId[rc?.ResourceID!]?.qty : 0,
            tph: 0,
            rtsSupport: "",
            bookTruckVendor: "",
            grinder4ft: 0,
            grinder6ft: 0,
            grinder7ft: 0,
            grinder12ft: 0,
            extraWork: "",
            uts: "",
            mixDesignApproval: "",
            addedFromPaving: false,
            updated: true,
            loadOutTime: "",
            addedDate: "",
            material: "",
            oilTruck: "",
            plant: "",
            timeStamp: "",
            tonnage: 0
          } as MasterCrewSchedulePaving
        ));
    })

  }, [data, props.jobNumber, setState, state.resources.length, props.unix, props.locationIndex, props.pavingResources])

  useEffect(() => {
    if (state == null || state.resources == null) return;
    setState(draft => {
      draft.qtySum = state.resources
        .map(tr => tr?.qty)
        .reduce((previousValue, currentValue) => previousValue! as number + currentValue! as number, 0) as number;
    })
  }, [state, setState])

  useEffect(() => {
    if (props.pavingResources != null) {
      if (props.pavingResources == null || props.pavingResources.length === 0) { return }

      const isGrinderUsed = props.pavingResources[0]?.grinder12ft != null
        || props.pavingResources[0]?.grinder4ft != null
        || props.pavingResources[0]?.grinder6ft != null
        || props.pavingResources[0]?.grinder7ft != null;

      setPavingState(draft => {
        draft.mixSubmital = props.pavingResources[0]?.mixSubmital?.trim();
        draft.material = props.pavingResources[0]?.material;
        draft.plant = props.pavingResources[0]?.plant;
        draft.tonnage = props.pavingResources[0]?.tonnage;
        draft.oilTruck = props.pavingResources[0]?.oilTruck;
        draft.shift = props.pavingResources[0]?.shift
        draft.notes = props.pavingResources[0]?.notes
        draft.rtsSupport = props.pavingResources[0]?.rtsSupport == null ? "" : props.pavingResources[0]?.rtsSupport as string
        draft.tph = props.pavingResources[0]?.tph
        draft.grinder4ft = props.pavingResources[0]?.grinder4ft! as number
        draft.grinder6ft = props.pavingResources[0]?.grinder6ft! as number
        draft.grinder7ft = props.pavingResources[0]?.grinder7ft! as number
        draft.grinder12ft = props.pavingResources[0]?.grinder12ft! as number
        draft.bookTruckVendor = props.pavingResources[0]?.bookTruckVendor as string
        draft.extraWork = props.pavingResources[0]?.extraWork
        draft.uts = props.pavingResources[0]?.uts
        draft.mixDesignApproval = props.pavingResources[0]?.mixDesignApproval
        draft.grinderCheckBox = isGrinderUsed
        draft.rtsSupportCheckBox = (props.pavingResources[0]?.rtsSupport !== "" && props.pavingResources[0]?.rtsSupport != null) ? true : false
        draft.addedFromPaving = props.pavingResources[0]?.addedFromPaving
        draft.updated = true
        draft.timeStamp = props.pavingResources[0]?.timeStamp
        draft.loadOutTime = props.pavingResources[0]?.loadOutTime
        draft.addedDate = props.pavingResources[0]?.addedDate == null || props.pavingResources[0]?.addedDate === "" ? "" : props.pavingResources[0]?.addedDate
      });
      return;
    }
  }, [props.jobNumber, props.locationIndex, props.pavingResources, props.unix, setPavingState, setState])


  useEffect(() => {
    // if the checkbox that enables the inputs are unchecked and the inputs have values, it puts empty string or null
    if (pavingState.oilTruck === 'false' && (pavingState.bookTruckVendor == null || pavingState.bookTruckVendor === "")) {
      setPavingState(draft => {
        draft.bookTruckVendor = "";
      });
    }

    // if the user uncheck the oilTruck and in the bookTruckVendor has data filled, then we will empty the string
    if (pavingState.oilTruck === 'false' && pavingState.bookTruckVendor != null && pavingState.bookTruckVendor as string !== "") {
      setPavingState(draft => {
        draft.bookTruckVendor = "";
      });
    }

    if (pavingState.rtsSupportCheckBox === false) {
      setPavingState(draft => {
        draft.rtsSupport = "";
      })
    }
  }, [setPavingState, pavingState])

  const dispatch = useDispatch();

  const _plantData = trucking?.truckingDatas
    .filter(td => td?.type === "Plant")
    ?.sort((a, b) => a?.value! < b?.value! ? -1 : 1)

  const shift = [
    {
      key: 1,
      value: "N"
    },
    {
      key: 2,
      value: "D"
    }
  ];

  const specialShifts = [
    {
      key: 1,
      value: "N 2"
    },
    {
      key: 2,
      value: "D 2"
    }
  ]

  const checkForLockedDays = () => {
    let _lockedDays: Maybe<number>[] = [];
    lockedDaysData?.superIntendentPavingCalendar.forEach((item: Maybe<SuperIntendentPavingCalendar>) => {
      if (item?.jobNumbersBlocked?.includes(jobNumber as number) || item?.status === true) _lockedDays.push(item.date)
    })
    return _lockedDays;
  }

  const onChangeQty = (index: number, e: any) => {
    let value: "" | number = parseInt(e.target.value);
    value = isNaN(value) ? "" : value;

    if (value < 0) { return }

    if (value.toString().length > 5) {
      return;
    }

    setState(draft => {
      draft.resources[index]!.qty = value as number;
    })
  }

  const onCheckboxChange = (index: number, checked: boolean) => {
    setState(draft => {
      if (checked === true) {
        draft.resources[index]!.qty = 1;
      }

      if (checked === false) {
        draft.resources[index]!.qty = 0;
      }
    })
  }

  const onShiftChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const _eValue = e.target.value;
    let loadOutTimeValue: string = "";
    const shiftLocation1 = pavingResurcesLocation1ForPaving?.map(e => e?.shift)?.[0];
    const shiftLocation2 = pavingResurcesLocation2ForPaving?.map(e => e?.shift)?.[0];
    const shiftLocation3 = pavingResurcesLocation3ForPaving?.map(e => e?.shift)?.[0];
    const shiftLocation4 = pavingResurcesLocation4ForPaving?.map(e => e?.shift)?.[0];


    if ((_eValue === "N" || _eValue === "N 2") && pavingState.loadOutTime?.includes("AM")) {
      loadOutTimeValue = pavingState.loadOutTime?.replace("AM", "PM");

      if (pavingState.loadOutTime === "00:00 AM") {
        loadOutTimeValue = "12:00 PM";
      }
      if (pavingState.loadOutTime === "00:30 AM") {
        loadOutTimeValue = "12:30 PM";
      }
    }

    if ((_eValue === "D" || _eValue === "D 2") && pavingState.loadOutTime?.includes("PM")) {
      loadOutTimeValue = pavingState.loadOutTime?.replace("PM", "AM");

      if (pavingState.loadOutTime === "12:00 PM") {
        loadOutTimeValue = "00:00 AM";
      }
      if (pavingState.loadOutTime === "12:30 PM") {
        loadOutTimeValue = "00:30 AM";
      }
    }

    setPavingState(draft => {
      draft.shift = _eValue;
    })

    if (loadOutTimeValue !== "") {
      setPavingState(draft => {
        draft.loadOutTime = loadOutTimeValue;
      })
    }

    setSameShift(false);
    if ((props.locationIndex === 1 && _eValue === shiftLocation2) || (props.locationIndex === 2 && _eValue === shiftLocation1)) {
      setSameShift(true);
      modal?.openModal?.({
        element: <GeneralWarningModal
          message="You have the same shift on the other location. Please change, otherwise you will cannot save"
          title="Paving Management Warning"
          yesNoButtons={false}
        />
      })
    }

    if ((props.locationIndex === 3 && _eValue === shiftLocation4) || (props.locationIndex === 4 && _eValue === shiftLocation3)) {
      setSameShift(true);
      modal?.openModal?.({
        element: <GeneralWarningModal
          message="You have the same shift on the other location. Please change, otherwise you will cannot save"
          title="Paving Management Warning"
          yesNoButtons={false}
        />
      })
    }
  }

  const onNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const _eValue = e.target.value;

    if (_eValue.length > 250) {
      return;
    }

    setPavingState(draft => {
      draft.notes = _eValue;
    })
  }

  const onMixSubmitalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const _eValue = e.target.value;
    setPavingState(draft => {
      draft.mixSubmital = _eValue;
    })
  }

  const onMixDesignApprovalChange = (checked: boolean) => {
    const value = checked === true ? "Y" : "N";

    setPavingState(draft => {
      draft.mixDesignApproval = value;
    })
  }

  const onMaterialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const _eValue = e.target.value;
    setPavingState(draft => {
      draft.material = _eValue;
    })
  }

  const onPlantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const _eValue = e.target.value;
    setPavingState(draft => {
      draft.plant = _eValue;
    })
  }

  const onOilTruckChange = (checked: boolean) => {
    setPavingState(draft => {
      draft.oilTruck = checked.toString();
    })
  }

  const onRtsSupportCheckBoxChange = (checked: boolean) => {
    setPavingState(draft => {
      draft.rtsSupportCheckBox = checked;
    })
  }

  const onUtsCheckBoxChange = (checked: boolean) => {
    const value = checked === true ? "Y" : "N";

    setPavingState(draft => {
      draft.uts = value;
    })
  }

  const onGrinderCheckBoxChange = (checked: boolean) => {
    setPavingState(draft => {
      draft.grinderCheckBox = checked;
      if (checked === false) {
        draft.grinder4ft = null;
        draft.grinder6ft = null;
        draft.grinder7ft = null;
        draft.grinder12ft = null;
      }
    })
  }

  const onExtraWorkChange = (checked: boolean) => {
    const value = checked === true ? "Y" : "N";

    setPavingState(draft => {
      draft.extraWork = value;
    })
  }

  const onTonnageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const _eValue = e.target.value;

    let tonnage: number | "" = parseInt(_eValue);
    tonnage = isNaN(tonnage) ? "" : tonnage;
    if (tonnage < 0) { return }

    if (tonnage.toString().length > 5) {
      return;
    }

    setPavingState(draft => {
      draft.tonnage = tonnage as number;
    })
  }

  const onTPHChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value: "" | number = parseInt(e.target.value);
    value = isNaN(value) ? "" : value;

    if (value < 0) { return }

    if (value.toString().length > 3) {
      return;
    }

    setPavingState(draft => {
      draft.tph = value as number;
    })
  }

  const onRtsSupportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const _eValue = e.target.value;
    setPavingState(draft => {
      draft.rtsSupport = _eValue;
    })
  }

  const onBookTruckVendorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const _eValue = e.target.value;
    setPavingState(draft => {
      draft.bookTruckVendor = _eValue;
    })
  }

  const onGrinder4ftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value: "" | number = parseInt(e.target.value);
    value = isNaN(value) ? "" : value;

    if (value < 0) { return }

    if (value.toString().length > 3) {
      return;
    }

    setPavingState(draft => {
      draft.grinder4ft = value as number;
    })
  }

  const onGrinder6ftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value: "" | number = parseInt(e.target.value);
    value = isNaN(value) ? "" : value;

    if (value < 0) { return }

    if (value.toString().length > 3) {
      return;
    }

    setPavingState(draft => {
      draft.grinder6ft = value as number;
    })
  }

  const onGrinder7ftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value: "" | number = parseInt(e.target.value);
    value = isNaN(value) ? "" : value;

    if (value < 0) { return }

    if (value.toString().length > 3) {
      return;
    }

    setPavingState(draft => {
      draft.grinder7ft = value as number;
    })
  }

  const onGrinder12ftChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value: "" | number = parseInt(e.target.value);
    value = isNaN(value) ? "" : value;

    if (value < 0) { return }

    if (value.toString().length > 3) {
      return;
    }

    setPavingState(draft => {
      draft.grinder12ft = value as number;
    })
  }

  const onCannedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const _eValue = e.target.value;
    const cannedResources = canned?.canned.filter(c => c?.cannedCode === _eValue)[0]?.cannedResources as Maybe<CannedResources>[];
    const _cannedResources = toMap(cannedResources, c => c?.resourceID ?? "");

    if (cannedResources == null || _cannedResources == null) return;
    setState(draft => {
      draft.resources = state.resources.map(resource => ({
        ...resource,
        qty: _cannedResources[resource?.resourceID!]?.resourceQty
      }));
    })
    setState(draft => {
      draft.cannedCode = _eValue;
    })
  }

  //We need to make the function to wait for the refetch
  const clearTheDay = () => {
    dispatch(clearDay({ locationIndex: props.locationIndex, unix: props.unix }));
    props.onClose?.()
  }

  const onSubmit = async () => {
    setLoadingSave(true)
    const [error, response] = await to(
      client.query({
        query: SUPER_INTENDENT_PAVING_CALENDAR_QUERY, variables: {
          where: {
            startDate: props.unix,
            endDate: props.unix,
          }
        }
      })
    );

    if (error == null) {
      let _lockedDays: Maybe<number>[] = [];
      response?.data.superIntendentPavingCalendar.forEach((item: Maybe<SuperIntendentPavingCalendar>) => {
        if (item?.jobNumbersBlocked?.includes(jobNumber as number) || item?.status === true) _lockedDays.push(item.date)
      })

      setTimeout(() => {
        if (_lockedDays.includes(props?.unix)) {
          modal?.openModal?.({
            element: <GeneralWarningModal
              message="This day was locked while you were working. No more changes can be made to it."
              title="Locked day"
              yesNoButtons={false}
              onClose={() => {
                clearTheDay()
              }}
            />
          })
        }
        else {
          let pavingResourcesForAllocation = state.resources.filter(r => r?.qty as number > 0 && r?.qty != null);

          let pavingResources: MasterCrewSchedulePaving[] = [];
          const truckingData: MasterCrewSchedule[] = [];
          const pavingData: AddMasterCrewSchedulesPavingInput[] = [];

          pavingResourcesForAllocation.forEach(pr => {
            pavingResources.push({
              material: pavingState.material,
              mixSubmital: pavingState.mixSubmital,
              plant: pavingState.plant,
              tonnage: pavingState.tonnage,
              oilTruck: pavingState.oilTruck,
              shift: pavingState.shift,
              resourceID: pr?.resourceID,
              resourceDescription: pr?.resourceDescription,
              resourceType: pr?.resourceType,
              jobNumber: props.jobNumber,
              searchGSI_JobNumber: props.jobNumber,
              date: pr?.date,
              locationIndex: props.locationIndex,
              qty: pr?.qty,
              notes: pavingState.notes,
              bookTruckVendor: pavingState?.bookTruckVendor as string,
              rtsSupport: pavingState?.rtsSupport == null ? "" : pavingState?.rtsSupport,
              tph: pavingState?.tph,
              grinder4ft: pavingState.grinder4ft as number,
              grinder6ft: pavingState.grinder6ft as number,
              grinder7ft: pavingState.grinder7ft as number,
              grinder12ft: pavingState.grinder12ft as number,
              mixDesignApproval: pavingState.mixDesignApproval,
              extraWork: pavingState.extraWork,
              uts: pavingState.uts,
              addedFromPaving: false,
              updated: true,
              timeStamp: moment().format(),
              loadOutTime: pavingState.loadOutTime as string,
              addedDate: (pavingState.addedDate != null && pavingState.addedDate !== "") ? pavingState.addedDate : moment().utc().format("YYYY-MM-DD")
            })
          })

          if (!verifyPavResourcesOnTrucking()) {
            showTruckingModal();
          }
          else if (checkIfTrkHasQty0()) {
            showMaterialChanged();
          }
          else {
            props.onApply(1);
            let _trkResources = truckingResources.filter(lr => lr?.operationType === "paving");
            let trkResourcesQty = _trkResources
              ?.map(tr => tr?.qty)
              ?.reduce((previousValue, currentValue) => previousValue! as number + currentValue! as number, 0) as number;

            const jobInfo: JobInfoFullInput[] = [];

            selectedDates?.forEach(date => {
              jobInfo.push(
                {
                  jobNumber_Date: parseInt(`${jobNumberInformations?.jobNumber}${(moment.utc(date, "YYYY-MM-DD").unix()) * 1000}`) / 1000,
                  searchGSI_JobNumber: jobNumberInformations?.jobNumber,
                  tableauGSI_Tableau: "tableau",
                  resourceName: "Paving Crew",
                  resourceQTY: 1,
                  resourceID: "PAV",
                  resourceType: "Labor",
                  date: (moment.utc(date, "YYYY-MM-DD").unix()) * 1000,
                  additionalResourcesComments: " ",
                  areaManager: jobNumberInformations?.areaManager == null ? " " : jobNumberInformations?.areaManager,
                  description: " ",
                  foreman: " ",
                  jobName: jobNumberInformations?.jobName == null ? " " : jobNumberInformations?.jobName,
                  locationIndex: props.locationIndex,
                  pmpe: jobNumberInformations?.projectManager == null ? " " : jobNumberInformations?.projectManager as string,
                  superIntendent: jobNumberInformations?.superIntendentName == null ? " " : jobNumberInformations?.superIntendentName as string,
                  pavingForeman: " ",
                  pavingSuperIntendent: " "
                },
                {
                  jobNumber_Date: parseInt(`${jobNumberInformations?.jobNumber}${(moment.utc(date, "YYYY-MM-DD").unix()) * 1000}`) / 1000,
                  searchGSI_JobNumber: jobNumberInformations?.jobNumber,
                  tableauGSI_Tableau: "tableau",
                  resourceName: "Trucking",
                  resourceQTY: trkResourcesQty,
                  resourceID: "TRK",
                  resourceType: "Equipment",
                  date: (moment.utc(date, "YYYY-MM-DD").unix()) * 1000,
                  additionalResourcesComments: " ",
                  areaManager: jobNumberInformations?.areaManager == null ? " " : jobNumberInformations?.areaManager,
                  description: " ",
                  foreman: " ",
                  jobName: jobNumberInformations?.jobName == null ? " " : jobNumberInformations?.jobName,
                  locationIndex: props.locationIndex,
                  pmpe: jobNumberInformations?.projectManager == null ? " " : jobNumberInformations?.projectManager as string,
                  superIntendent: jobNumberInformations?.superIntendentName == null ? " " : jobNumberInformations?.superIntendentName as string,
                  pavingForeman: " ",
                  pavingSuperIntendent: " ",
                },
                {
                  jobNumber_Date: parseInt(`${jobNumberInformations?.jobNumber}${(moment.utc(date, "YYYY-MM-DD").unix()) * 1000}`) / 1000,
                  searchGSI_JobNumber: jobNumberInformations?.jobNumber,
                  tableauGSI_Tableau: "tableau",
                  resourceName: "AC Paving Crew",
                  resourceQTY: 1,
                  resourceID: "ACP",
                  resourceType: "Labor",
                  date: (moment.utc(date, "YYYY-MM-DD").unix()) * 1000,
                  additionalResourcesComments: " ",
                  areaManager: jobNumberInformations?.areaManager == null ? " " : jobNumberInformations?.areaManager,
                  description: " ",
                  foreman: " ",
                  jobName: jobNumberInformations?.jobName == null ? " " : jobNumberInformations?.jobName,
                  locationIndex: props.locationIndex,
                  pmpe: jobNumberInformations?.projectManager == null ? " " : jobNumberInformations?.projectManager as string,
                  superIntendent: jobNumberInformations?.superIntendentName == null ? " " : jobNumberInformations?.superIntendentName as string,
                  pavingForeman: " ",
                  pavingSuperIntendent: " "
                },
              );

              _trkResources.forEach(tr => {
                truckingData.push({
                  date: (moment.utc(date, "YYYY-MM-DD").unix()) * 1000,
                  locationIndex: props.locationIndex,
                  broker: tr?.broker as string,
                  jobNumber: jobNumberInformations?.jobNumber as number,
                  tableauGSI_Tableau: "tableau",
                  searchGSI_JobNumber: jobNumberInformations?.jobNumber as number,
                  loadSite: tr?.loadSite as string,
                  material: tr?.material as string,
                  notes: " ",
                  operationType: tr?.operationType as string,
                  qty: tr?.qty as number,
                  shift: pavingState.shift as string,
                  type: tr?.type as string,
                  addedFromPaving: tr?.addedFromPaving != null ? tr?.addedFromPaving : true,
                  updated: tr?.updated != null ? tr?.updated : true,
                  timeStamp: tr?.timeStamp != null ? tr?.timeStamp : moment().format(),
                })
              })

              pavingResources.forEach(pr => {
                pavingData.push({
                  ...pr,
                  date: (moment.utc(date, "YYYY-MM-DD").unix()) * 1000
                })
              })

            });

            selectedDates.forEach(sd => {
              dispatch(addPavingFromPavingManagement({ jobInfoResources: jobInfo, locationIndex: props.locationIndex, jobInfoToUpdate: null, unix: (moment.utc(sd, "YYYY-MM-DD").unix()) * 1000 }))
              dispatch(addPavingResourcesToDay({ locationIndex: props.locationIndex, unix: (moment.utc(sd, "YYYY-MM-DD").unix()) * 1000, pavingResources: pavingData.filter(p => p.date === (moment.utc(sd, "YYYY-MM-DD").unix()) * 1000) }));
              dispatch(addTruckingResourcesToDayFromPavingManagement({ locationIndex: props.locationIndex, unix: (moment.utc(sd, "YYYY-MM-DD").unix()) * 1000, truckingResources: truckingData.filter(p => p?.date === (moment.utc(sd, "YYYY-MM-DD").unix()) * 1000) }));
            });

            // let _trResource = truckingResources.filter(lr => lr?.operationType === "paving");
            // let _truckingResourceQty = _trResource
            //   ?.map(tr => tr?.qty)
            //   ?.reduce((previousValue, currentValue) => previousValue! as number + currentValue! as number, 0) as number;

            // const _truckingData: MasterCrewSchedule[] = [];
            // const _pavingData: AddMasterCrewSchedulesPavingInput[] = [];
            // const _jobInfo: JobInfoFullInput[] = [];

            // datesOutOfGeneratedDays.forEach(async date => {
            //   _jobInfo.push(
            //     {
            //       jobNumber_Date: parseInt(`${jobNumberInformations?.jobNumber}${(moment.utc(date, "YYYY-MM-DD").unix()) * 1000}`) / 1000,
            //       searchGSI_JobNumber: jobNumberInformations?.jobNumber,
            //       tableauGSI_Tableau: "tableau",
            //       resourceName: "Paving Crew",
            //       resourceQTY: 1,
            //       resourceID: "PAV",
            //       resourceType: "Labor",
            //       date: (moment.utc(date, "YYYY-MM-DD").unix()) * 1000,
            //       additionalResourcesComments: " ",
            //       areaManager: jobNumberInformations?.areaManager == null ? " " : jobNumberInformations?.areaManager,
            //       description: " ",
            //       foreman: " ",
            //       jobName: jobNumberInformations?.jobName == null ? " " : jobNumberInformations?.jobName,
            //       locationIndex: props.locationIndex,
            //       pmpe: jobNumberInformations?.projectManager == null ? " " : jobNumberInformations?.projectManager as string,
            //       superIntendent: jobNumberInformations?.superIntendentName == null ? " " : jobNumberInformations?.superIntendentName as string,
            //       pavingForeman: " ",
            //       pavingSuperIntendent: " "
            //     },
            //     {
            //       jobNumber_Date: parseInt(`${jobNumberInformations?.jobNumber}${(moment.utc(date, "YYYY-MM-DD").unix()) * 1000}`) / 1000,
            //       searchGSI_JobNumber: jobNumberInformations?.jobNumber,
            //       tableauGSI_Tableau: "tableau",
            //       resourceName: "AC Paving Crew",
            //       resourceQTY: 1,
            //       resourceID: "ACP",
            //       resourceType: "Labor",
            //       date: (moment.utc(date, "YYYY-MM-DD").unix()) * 1000,
            //       additionalResourcesComments: " ",
            //       areaManager: jobNumberInformations?.areaManager == null ? " " : jobNumberInformations?.areaManager,
            //       description: " ",
            //       foreman: " ",
            //       jobName: jobNumberInformations?.jobName == null ? " " : jobNumberInformations?.jobName,
            //       locationIndex: props.locationIndex,
            //       pmpe: jobNumberInformations?.projectManager == null ? " " : jobNumberInformations?.projectManager as string,
            //       superIntendent: jobNumberInformations?.superIntendentName == null ? " " : jobNumberInformations?.superIntendentName as string,
            //       pavingForeman: " ",
            //       pavingSuperIntendent: " "
            //     },
            //     {
            //       jobNumber_Date: parseInt(`${jobNumberInformations?.jobNumber}${(moment.utc(date, "YYYY-MM-DD").unix()) * 1000}`) / 1000,
            //       searchGSI_JobNumber: jobNumberInformations?.jobNumber,
            //       tableauGSI_Tableau: "tableau",
            //       resourceName: "Trucking",
            //       resourceQTY: _truckingResourceQty,
            //       resourceID: "TRK",
            //       resourceType: "Equipment",
            //       date: (moment.utc(date, "YYYY-MM-DD").unix()) * 1000,
            //       additionalResourcesComments: " ",
            //       areaManager: jobNumberInformations?.areaManager == null ? " " : jobNumberInformations?.areaManager,
            //       description: " ",
            //       foreman: " ",
            //       jobName: jobNumberInformations?.jobName == null ? " " : jobNumberInformations?.jobName,
            //       locationIndex: props.locationIndex,
            //       pmpe: jobNumberInformations?.projectManager == null ? " " : jobNumberInformations?.projectManager as string,
            //       superIntendent: jobNumberInformations?.superIntendentName == null ? " " : jobNumberInformations?.superIntendentName as string,
            //       pavingForeman: " ",
            //       pavingSuperIntendent: " "
            //     },
            //   );

            //   _trResource.forEach(tr => {
            //     _truckingData.push({
            //       date: (moment.utc(date, "YYYY-MM-DD").unix()) * 1000,
            //       locationIndex: props.locationIndex,
            //       broker: tr?.broker as string,
            //       jobNumber: jobNumberInformations?.jobNumber as number,
            //       tableauGSI_Tableau: "tableau",
            //       searchGSI_JobNumber: jobNumberInformations?.jobNumber as number,
            //       loadSite: tr?.loadSite as string,
            //       material: tr?.material as string,
            //       notes: " ",
            //       operationType: tr?.operationType as string,
            //       qty: tr?.qty as number,
            //       shift: pavingState.shift as string,
            //       type: tr?.type as string,
            //       addedFromPaving: tr?.addedFromPaving != null ? tr?.addedFromPaving : true,
            //       updated: tr?.updated != null ? tr?.updated : true,
            //       timeStamp: tr?.timeStamp != null ? tr?.timeStamp : moment().format()
            //     })
            //   })

            //   pavingResources.forEach(pr => {
            //     _pavingData.push({
            //       ...pr,
            //       date: (moment.utc(date, "YYYY-MM-DD").unix()) * 1000
            //     })
            //   })
            // })
            props.onClose?.()
          }
        }
        setLoadingSave(false)
      }, 3000)
    }
  }

  useEffect(() => {
    async function checkForLocked() {
      refetchLockedDays();
      if (checkForLockedDays()?.includes(props.unix)) {
        setState(draft => {
          draft.buttonDisabled = true;
        })
      }
      else {
        setState(draft => {
          draft.buttonDisabled = false;
        })
      }
    }

    let pavingResourcesForAllocation = state.resources.filter(r => r?.qty as number > 0 && r?.qty != null);

    if (pavingState.material == null ||
      pavingState.material === "" ||
      pavingState.mixSubmital == null ||
      pavingState.mixSubmital === "" ||
      pavingState.plant == null ||
      pavingState.plant === "" ||
      pavingState.tonnage == null ||
      pavingState.tonnage.toString() === "" ||
      pavingResourcesForAllocation.length === 0 ||
      pavingState.shift == null ||
      pavingState.shift === "" ||
      ((pavingState.bookTruckVendor == null || pavingState.bookTruckVendor === "") && pavingState.oilTruck === "true")
    ) {
      setState(draft => {
        draft.buttonDisabled = true;
      })
    }
    else {
      checkForLocked();
    }
  }, [pavingState, state, setState, onSubmit])


  const onQtyChange = (value: string) => {
    let qty: number | "" = parseInt(value);
    qty = isNaN(qty) ? "" : qty;

    dispatch(addTruckingQTYFromPaving({ locationIndex: props.locationIndex, unix: props.unix, qty: qty as number }));
  }

  const onTimeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as string;
    const shiftLocation1 = pavingResurcesLocation1ForPaving?.map(e => e?.shift)?.[0];
    const shiftLocation2 = pavingResurcesLocation2ForPaving?.map(e => e?.shift)?.[0];
    const shiftLocation3 = pavingResurcesLocation3ForPaving?.map(e => e?.shift)?.[0];
    const shiftLocation4 = pavingResurcesLocation4ForPaving?.map(e => e?.shift)?.[0];
    let shift: string = "";

    setPavingState(draft => {
      draft.loadOutTime = value;
    })

    if (value.includes("AM")) {
      shift = (props.locationIndex === 1 || props.locationIndex === 2) ? "D" : "D 2";
      setPavingState(draft => {
        draft.shift = shift;
      })
    }

    if (value.includes("PM")) {
      shift = (props.locationIndex === 1 || props.locationIndex === 2) ? "N" : "N 2";
      setPavingState(draft => {
        draft.shift = shift;
      })
    }

    setSameShift(false);

    if ((props.locationIndex === 1 && shift === shiftLocation2) || (props.locationIndex === 2 && shift === shiftLocation1)) {
      setSameShift(true);
      modal?.openModal?.({
        element: <GeneralWarningModal
          message="You have the same shift on the other location. Please change, otherwise you will cannot save"
          title="Paving Management Warning"
          yesNoButtons={false}
        />
      })
    }

    if ((props.locationIndex === 3 && shift === shiftLocation4) || (props.locationIndex === 4 && shift === shiftLocation3)) {
      setSameShift(true);
      modal?.openModal?.({
        element: <GeneralWarningModal
          message="You have the same shift on the other location. Please change, otherwise you will cannot save"
          title="Paving Management Warning"
          yesNoButtons={false}
        />
      })
    }
  }

  const setShowTruckingAssigment = () => {
    modal?.openModal?.({
      element: <TruckingManagement
        unix={props.unix}
        locationIndex={props.locationIndex}
        jobNumber={props.jobNumber as number}
        onApply={(value: string | number) => { onQtyChange(value as string) }}
        shift={pavingState.shift as string}
        material={pavingState.material as string}
        loadSite={pavingState.plant as string}
        // canAddPavingResources={truckingResources.filter(lr => lr?.operationType === "paving").length > 0 ? false : true}
        canAddPavingResources={true}
        fromPavingManagement={true}
      />
    })
  }

  const verifyPavResourcesOnTrucking = () => {
    let hasTrkWithPav = false;
    truckingResources.forEach(tr => {
      if (tr?.operationType === "paving") {
        hasTrkWithPav = true;
      }
    });
    return hasTrkWithPav;
  }

  const checkIfTrkHasQty0 = () => {
    let hasTrkWithQty0 = false;
    truckingResources.forEach(tr => {
      if (tr?.operationType === "paving" && (tr?.qty === 0 && tr?.material === "No Material" && tr?.loadSite === "None – Job Prep") && (pavingState.material !== "No Material" || pavingState?.plant !== "None – Job Prep")) {
        hasTrkWithQty0 = true;
      }
    });
    return hasTrkWithQty0;
  }

  const showTruckingModal = () => {
    modal?.openModal({
      element: <TruckingResourcesNotAllocated
        message="You must add at least one resource with operation type paving"
        title="Trucking resources with operation type paving not allocated"
        yesNoButtons={false}
        onClose={() => setShowTruckingAssigment()}
      />
    });
  }

  const showMaterialChanged = () => {
    modal?.openModal({
      element: <GeneralWarningModal
        message="You must add qty now that your material has changed"
        title="Trucking resources with 0 qty"
        yesNoButtons={false}
        onClose={() => setShowTruckingAssigment()}
      />
    });
  }

  const showCancelAssignmentModal = () => {

    const isGrinderUsed = props.pavingResources[0]?.grinder12ft != null
      || props.pavingResources[0]?.grinder4ft != null
      || props.pavingResources[0]?.grinder6ft != null
      || props.pavingResources[0]?.grinder7ft != null;

    if (pavingState.mixSubmital !== props.pavingResources[0]?.mixSubmital ||
      pavingState.material !== props.pavingResources[0]?.material ||
      pavingState.plant !== props.pavingResources[0]?.plant ||
      pavingState.tonnage !== props.pavingResources[0]?.tonnage ||
      pavingState.oilTruck !== props.pavingResources[0]?.oilTruck ||
      pavingState.shift !== props.pavingResources[0]?.shift ||
      pavingState.notes !== props.pavingResources[0]?.notes ||
      pavingState.rtsSupport !== props.pavingResources[0]?.rtsSupport ||
      pavingState.tph !== props.pavingResources[0]?.tph ||
      pavingState.grinder4ft !== props.pavingResources[0]?.grinder4ft! as number ||
      pavingState.grinder6ft !== props.pavingResources[0]?.grinder6ft! as number ||
      pavingState.grinder7ft !== props.pavingResources[0]?.grinder7ft! as number ||
      pavingState.grinder12ft !== props.pavingResources[0]?.grinder12ft! as number ||
      pavingState.bookTruckVendor !== props.pavingResources[0]?.bookTruckVendor ||
      pavingState.extraWork !== props.pavingResources[0]?.extraWork ||
      pavingState.uts !== props.pavingResources[0]?.uts ||
      pavingState.mixDesignApproval !== props.pavingResources[0]?.mixDesignApproval ||
      pavingState.grinderCheckBox !== isGrinderUsed) {
      if (pavingResourcesRedux.length === 0 && props.indexPosition != null) {
        dispatch(RemoveJob({
          locationIndex: props.locationIndex,
          unix: props.unix,
          indexPos: props?.indexPosition as number,
          resourceType: "labor",
          resourceID: "PAV"
        }));
      }
      if (verifyPavResourcesOnTrucking() === false) {
        modal?.openModal?.({
          element:
            <CancelAssignment
              onConfirm={props?.onClose}
            />
        })
      }
      else {
        if (pavingResourcesRedux != null && pavingResourcesRedux.length === 0) {
          let message = "You have to assign a Paving Crew because you already added a Trucking resource with operation type paving. Do you still want to close?";
          let title = "Paving Crew needed";
          if (checkForLockedDays().includes(props?.unix)) {
            message = "This day was locked while you were working. No more changes can be made to it.";
            title = "Locked day";
          }
          modal?.openModal?.({
            element: (
              <GeneralWarningModal
                message={message}
                title={title}
                yesNoButtons={false}
                onClose={() => {
                  clearTheDay()
                }}
              />
            ),
          });
        }
        else {
          modal?.openModal?.({
            element:
              <CancelAssignment
                onConfirm={props?.onClose}
              />
          })
        }
      }
    } else {
      props.onClose?.();
    }
  }

  const getDates = useCallback(() => {
    return toMap(pavings ?? [], pavings => pavings?.date!, () => true);
  }, [pavings])

  const getDatesWithMoreThanThreeJN = () => {
    const groupedDates = toMultiMap(datesInPavingCalendar?.datesInPavingCalendar ?? [], date => date?.date!);
    const dates = Object.keys(groupedDates)
      .map(date => groupedDates[date].map(d => d?.jobNumber))
      .map((gd, i) => gd.filter((item, index) => gd.indexOf(item) === index).length >= 3
        ? Object.keys(groupedDates)[i]
        : null
      )
    return dates.filter(d => d !== null)
  }

  const onDatesSelected = (dates: string[]) => {

    // dates.forEach(d => {
    //   if (!generatedDays.includes((moment.utc(d, "YYYY-MM-DD").unix()) * 1000)) {
    //     //dates.splice(dates.indexOf(d));
    //     let _dates: string[] = datesOutOfGeneratedDays;
    //     if (!_dates.includes(d) && !lockedDays.includes((moment.utc(d, "YYYY-MM-DD").unix()) * 1000)) {
    //       _dates.push(d);
    //     }
    //     setDatesOutOfGeneratedDays(_dates);
    //   }
    // })

    if (dates.length === 0) {
      setSelectedDates([moment(props?.unix).utc().format("YYYY.MM.DD")]);
    }
    else {
      setSelectedDates(dates);
    }
  }

  const _generatedDays: number[] = [];
  generatedDays.forEach(ld => {
    if (!checkForLockedDays().includes(ld!)) {
      _generatedDays.push(ld)
    }
  })

  useEffect(() => {
    refetchLockedDays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, setState, pavingState, setPavingState, onChangeQty, onCheckboxChange, onShiftChange, onNotesChange, onMixSubmitalChange
    , onMixDesignApprovalChange, onMaterialChange, onPlantChange, onOilTruckChange, onRtsSupportCheckBoxChange, onUtsCheckBoxChange,
    onGrinderCheckBoxChange, onExtraWorkChange, onTonnageChange, onTPHChange, onRtsSupportChange, onBookTruckVendorChange,
    onGrinder4ftChange, onGrinder6ftChange, onGrinder7ftChange, onGrinder12ftChange, onCannedChange, onQtyChange, onTimeChange])

  return (
    <>
      {(lockedDaysLoading || loadingSave) && <FullScreenLoadingIndicator />}
      <div className="Manage_Paving_Main_Screen">
        <div className="Paving_Header">
          <div className="Date_Wrap">
            <img src={process.env.PUBLIC_URL + '/gr_logo_rgb.png'} alt="graniterock" />
            <div className="Title" title={checkForLockedDays().includes(props?.unix) ? "Locked Day" : ""}>
              {
                !checkForLockedDays().includes(((moment(props?.unix).utc().unix()) * 1000)) ?
                  <SelectMultipleDatesPavingManagement
                    currentDates={selectedDates}
                    onPickerChange={dates => onDatesSelected(dates)}
                    dates={getDates()}
                    redDates={getDatesWithMoreThanThreeJN()}
                    generatedDays={_generatedDays}
                    lockedDays={checkForLockedDays()}
                  />
                  : moment(props?.unix).utc().format("DD-MMM-YYYY")
              }
              {(checkForLockedDays().includes(props.unix)) ? <i className="fa fa-lock" aria-hidden="true"></i> : null}
            </div>
          </div>
          <CloseButton onClick={showCancelAssignmentModal} />
        </div>
        <div className="middle-content">
          <div className="Wrap_Inputs_Side">

            <div className="Equipment_Paving_Second">
              <div className="left_side">
                <div className="Paving_Title">
                  Paving for: {props.jobNumber} {(checkForLockedDays().includes(props.unix)) ? <i className="fa fa-lock" aria-hidden="true"></i> : null}
                </div>
                <div className="Row">
                  <div className="WrapCheckBox">
                    <div className="Wrap_Select">
                      <select className="dropdown" value={pavingState.material as string === " " || pavingState.material == null ? "" : pavingState.material as string} onChange={onMaterialChange} style={{ outline: 0, border: pavingState.material == null || pavingState.material === "" ? "3px solid rgba(255,0,0, 0.75)" : "none" }}>
                        <option value="" disabled>
                          Material:
                        </option>
                        {
                          materials.filter(m => m?.operationType === "paving")?.sort().map((bd, index) => (
                            <option value={bd?.value as string} key={index}>
                              {bd?.key !== bd?.value ? bd?.key as string + " - " + bd?.value as string : bd?.value as string}
                            </option>
                          ))
                        }
                      </select>
                    </div>
                    <button className="Tracking_Access_Link" onClick={() => setShowTruckingAssigment()} >Trucking</button>
                  </div>
                </div>
                <div className="Row">
                  <div className="CombinedCheckBox">
                    <input
                      onChange={(e) => { onMixSubmitalChange(e) }}
                      value={pavingState.mixSubmital as string}
                      type="text"
                      placeholder="Mix Submital"
                      style={{ border: pavingState.mixSubmital == null || pavingState.mixSubmital === "" ? "3px solid rgba(255,0,0, 0.75)" : "none" }}
                    />
                    <div className="WrapCheckBox">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={pavingState.mixDesignApproval === "Y" ? true : false}
                        onChange={(e) => { onMixDesignApprovalChange(e.target.checked) }} />
                      <div className="Row_Usage">Approved</div>
                    </div>
                  </div>
                </div>
                <div className="Row">
                  <div className="Combined">
                    <div className="Wrap_Select">
                      <select className="dropdown" value={pavingState.plant as string === " " || pavingState.plant == null ? "" : pavingState.plant as string} onChange={onPlantChange} style={{ outline: 0, border: pavingState.plant == null || pavingState.plant === "" ? "3px solid rgba(255,0,0, 0.75)" : "none" }}>
                        <option value="" disabled>
                          Plant:
                        </option>
                        {
                          _plantData?.map((bd, index) => (
                            <option value={bd?.value as string} key={index}>
                              {bd?.value}
                            </option>
                          ))
                        }
                      </select>
                    </div>
                    <input
                      type="text"
                      value={pavingState.tonnage?.toString?.() ?? ""}
                      onChange={(e) => onTonnageChange(e)}
                      placeholder="Tonnage"
                      style={{ border: pavingState.tonnage == null || pavingState.tonnage.toString() === "" ? "3px solid rgba(255,0,0, 0.75)" : "none" }}
                    />
                    <input
                      type="text"
                      value={pavingState.tph?.toString?.() ?? ""}
                      onChange={(e) => onTPHChange(e)}
                      placeholder="TPH" />
                  </div>
                </div>
                <div className="Row">
                  <div className="CombinedCheckBox">
                    <div className="WrapCheckBox">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={pavingState.oilTruck === "true" ? true : false}
                        onChange={(e) => { onOilTruckChange(e.target.checked) }} />
                      <div className="Row_Usage">Oil Truck:</div>
                    </div>
                    <input
                      type="text"
                      disabled={pavingState.oilTruck === "true" ? false : true}
                      value={pavingState.bookTruckVendor as string}
                      onChange={(e) => onBookTruckVendorChange(e)}
                      placeholder="Oil Truck Name"
                      style={{ border: pavingState.oilTruck === "true" && (pavingState.bookTruckVendor == null || pavingState.bookTruckVendor.trim() === "") ? "3px solid rgba(255,0,0, 0.75)" : "none" }}
                    />
                    <select className="dropdown" value={pavingState.loadOutTime as string === " " || pavingState.loadOutTime == null ? "" : pavingState.loadOutTime as string} onChange={(e) => onTimeChange(e)}>
                      <option value="" disabled>
                        Load Out:
                      </option>
                      {
                        loadOutTimeData != null && loadOutTimeData.loadOutTimeValues?.map((time, index: number) => (
                          <option value={time?.value?.toString()} key={index}>
                            {time?.value?.toString()}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                </div>
                <div className="Row">
                  <div className="Wrap_Select">
                    <select className="dropdown" value={pavingState.shift as string === " " || pavingState.shift == null ? "" : pavingState.shift as string} onChange={(e) => onShiftChange(e)} style={{ outline: 0, border: pavingState.shift == null || pavingState.shift === "" ? "3px solid rgba(255,0,0, 0.75)" : "none" }}>
                      <option value="" disabled>
                        Shift:
                      </option>
                      {
                        props.locationIndex === 1 || props.locationIndex === 2
                          ? shift.map((s, index) => (
                            <option value={s.value} key={index}>
                              {s.value}
                            </option>
                          ))
                          : (props.locationIndex === 3 || props.locationIndex === 4)
                            ? specialShifts.map((s, index) => (
                              <option value={s.value} key={index}>
                                {s.value}
                              </option>
                            ))
                            : null
                      }
                    </select>
                  </div>
                </div>
                <div className="Row">
                  <div className="CombinedCheckBox">
                    <div className="WrapCheckBox">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={pavingState.rtsSupportCheckBox === true ? true : false}
                        onChange={(e) => { onRtsSupportCheckBoxChange(e.target.checked) }} />
                      <div className="Row_Usage">RTS Support: </div>
                    </div>
                    <input
                      type="text"
                      disabled={pavingState.rtsSupportCheckBox === true ? false : true}
                      value={pavingState.rtsSupport as string}
                      onChange={(e) => onRtsSupportChange(e)} />
                  </div>
                </div>
                <div className="GrinderWrap">
                  <div className="Row">
                    <div className="WrapCheckBox">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={pavingState.grinderCheckBox === true ? true : false}
                        onChange={(e) => { onGrinderCheckBoxChange(e.target.checked) }} />
                      <div className="Row_Usage">Grinder?</div>
                    </div>
                  </div>
                  <div className="grinder">
                    <div className="Row">
                      <div className="Row_Usage">4ft: </div>
                      <input
                        type="text"
                        className={pavingState.grinderCheckBox === true ? "" : "disabled"}
                        disabled={pavingState.grinderCheckBox === true ? false : true}
                        value={pavingState.grinder4ft?.toString?.() ?? ""}
                        onChange={(e) => onGrinder4ftChange(e)} />
                    </div>
                    <div className="Row">
                      <div className="Row_Usage">6ft: </div>
                      <input
                        type="text"
                        className={pavingState.grinderCheckBox === true ? "" : "disabled"}
                        disabled={pavingState.grinderCheckBox === true ? false : true}
                        value={pavingState.grinder6ft?.toString?.() ?? ""}
                        onChange={(e) => onGrinder6ftChange(e)} />
                    </div>
                    <div className="Row">
                      <div className="Row_Usage">7ft: </div>
                      <input
                        type="text"
                        className={pavingState.grinderCheckBox === true ? "" : "disabled"}
                        disabled={pavingState.grinderCheckBox === true ? false : true}
                        value={pavingState.grinder7ft?.toString?.() ?? ""}
                        onChange={(e) => onGrinder7ftChange(e)} />
                    </div>
                    <div className="Row">
                      <div className="Row_Usage">12ft:</div>
                      <input
                        type="text"
                        className={pavingState.grinderCheckBox === true ? "" : "disabled"}
                        disabled={pavingState.grinderCheckBox === true ? false : true}
                        value={pavingState.grinder12ft?.toString?.() ?? ""}
                        onChange={(e) => onGrinder12ftChange(e)}
                      />
                    </div>
                  </div>
                </div>
                <div className="Row">
                  <div className="Checkboxes">
                    <div className="WrapCheckBox">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={pavingState.extraWork === "Y" ? true : false}
                        onChange={(e) => { onExtraWorkChange(e.target.checked) }} />
                      <div className="Row_Usage">ExtraWork </div>
                    </div>
                    <div className="WrapCheckBox">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={pavingState.uts === "Y" ? true : false}
                        onChange={(e) => { onUtsCheckBoxChange(e.target.checked) }} />
                      <div className="Row_Usage">UTS </div>
                    </div>
                  </div>
                </div>
                <div className="Row Notes">
                  <input
                    type="text"
                    value={pavingState.notes == null ? "" : pavingState.notes as string}
                    onChange={(e) => onNotesChange(e)}
                    placeholder="Notes"
                  />
                </div>
              </div>
              <div className="right_side">
                <div className="Paving_Before_Table">
                  <div className="Paving_Table_Title">CREW COMPOSITION</div>
                  <div className="Row">
                    <div className="WrapCheckBox">
                      <div className="Wrap_Select">
                        <select className="dropdown" value={state.cannedCode} onChange={onCannedChange} style={{ outline: 0, border: state.resources.filter(r => r?.qty as number > 0 && r?.qty != null).length === 0 ? "3px solid rgba(255,0,0, 0.75)" : "none" }}>
                          <option value="" disabled>
                            CREW:
                          </option>
                          {
                            canned?.canned?.sort((a, b) => a?.cannedCode! < b?.cannedCode! ? -1 : 1).map((c, index) => (
                              <option value={c?.cannedCode as string} key={index}>
                                {c?.cannedCode}
                              </option>
                            ))
                          }
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="Equipment_Paving_Main">
                  <div className="Equipment_Resources_Table">
                    <div className="Equipment_Table_Header">
                      <div>Select</div>
                      <div>Resource Name</div>
                      <div>Qty</div>
                    </div>
                    {state.resources?.map((rc: Maybe<MasterCrewSchedulePaving>, index: number) => (
                      <div className="Resource_Line" key={index} >
                        <div className="Resource_Check">
                          <CheckBox
                            onChange={(e) => { onCheckboxChange(index, e.target.checked) }}
                            checked={state.resources?.[index]?.qty as number > 0}
                          />
                        </div>
                        <div className="Paving_Resource_Name">
                          {rc?.resourceDescription as string}
                        </div>
                        <div className="Resource_Qu">
                          <TextInput
                            onChange={(e) => { onChangeQty(index, e) }}
                            value={state.resources?.[index]?.qty?.toString() ?? ""}
                            type="text"
                            placeholder={state.resources?.[index]?.qty?.toString() ?? "0"}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="Actions_Holder_Paving">
          <div className="buttons">
            <button
              onClick={() => onSubmit()}
              title={checkForLockedDays().includes(props.unix) ? "The day is locked" : ""}
              className="Button Add_Resources"
              disabled={(state.buttonDisabled || (checkForLockedDays().includes(props.unix))) || hasSameShift === true}
            > Assign </button>
            <button className="Button_Cancel" onClick={showCancelAssignmentModal}>Cancel</button>
          </div>
        </div>
      </div>
    </>
  )
}

export default memo(PavingManagement)