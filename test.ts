import { useMutation } from "@apollo/react-hooks";
import to from "await-to-js";
import moment from "moment";
import React, { FC, Fragment, useCallback, useContext, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useImmer } from "use-immer";
import { ADD_EQUIPMENT } from "../../../graphql/mutations/ADD_EQUIPMENT";
import { AddEquipmentManagementInput, EquipmentManagementSubCategoryData, EquipmentResource, EquipmentResourceManagementData, EquipmentResourceManagementDataInput, EquipmentSubcategories, EquipmentSubcategoryDataInput, Maybe, SuperIntendentPavingCalendarDatas } from "../../../graphql/schema-types";
import { updateEquipmentToPavingModule } from "../../../redux/appSlice";
import { RootState } from "../../../redux/store";
import { toMap } from "../../../utils/toMap";
import { toMultiMap } from "../../../utils/toMultiMap";
import { CheckBox } from "../../Form/CheckBox";
import { CloseButton } from "../../Form/CloseButton";
import { FullScreenLoadingIndicator } from "../../Modal/LoadingIndicator/FullScreenLoadingIndicator";
import { ModalContext } from "../../Modal/ModalContext/ModalContext";
import { GeneralWarningModal } from "../../Warnings & errors/GeneralWarningModal/GeneralWarningModal";
import "./EquipmentResources.css"

interface IEquipmentResourcesProps {
  onClose?(): void;
  equipmentResources: Maybe<EquipmentResource>[];
  item: Maybe<SuperIntendentPavingCalendarDatas>;
}
type StateResources = {
  resource: Maybe<EquipmentResourceManagementData>;
  checked: boolean;
}

export const EquipmentResources: FC<IEquipmentResourcesProps> = (props) => {
  const [state, setState] = useImmer({
    equipResourcesByEqId: {} as { [key: number]: StateResources },
    equipResourcesFilteredByJobNumber: [] as Maybe<EquipmentResourceManagementData>[],
    equipSubcategoryResourcesFilteredByJobNumber: [] as Maybe<EquipmentManagementSubCategoryData>[],
    equipResourcesBySubcategory: {} as { [key: string]: [StateResources] },
    equipResourcesBySubcategoryForCheck: {} as { [key: string]: [StateResources] },
    equipResourcesBySubcategoryForInput: [] as Maybe<EquipmentManagementSubCategoryData>[],
    isInputEmpty: false as boolean,
    isSingleUpdate: false as boolean,
  });

  const [addEquipment, { loading }] = useMutation(ADD_EQUIPMENT);

  const equipmentSubcategories = useSelector((state: RootState) => state.app?.equipmentSubcategories);
  let equipResourcesFromRedux = useSelector((state: RootState) => state.app?.pavingModule[props.item?.date].equipment);
  let equipSubcategoryResourcesFromRedux = useSelector((state: RootState) => state.app?.pavingModule[props.item?.date].equipmentSubCategory);
  let isDayDisabled = useSelector((state: RootState) => state.app?.pavingModule[props.item?.date].isDayBlocked);
  let isJobDisabled = useSelector((state: RootState) => state.app?.pavingModule[props.item?.date].jobNumbersBlocked.includes(props.item?.jobNumber as number));
  let isGeneral = useSelector((state: RootState) => state.app?.pavingModuleUser.isInGeneralPavingSupers);

  const [eqIDsRed, setEqIDsRed] = useState<Array<number>>([])
  const [currentSelectedEqIDs, setCurrentSelectedEqIDs] = useState<Array<number>>([]);

  const modal = useContext(ModalContext);

  const dispatch = useDispatch();

  useEffect(() => {
    if (equipResourcesFromRedux == null) { return }
    setState(draft => {
      draft.equipResourcesFilteredByJobNumber = equipResourcesFromRedux.filter(e => e?.jobNumber === props.item?.jobNumber);
    });

    if (equipSubcategoryResourcesFromRedux == null) { return }
    setState(draft => {
      draft.equipSubcategoryResourcesFilteredByJobNumber = equipSubcategoryResourcesFromRedux.filter(e => e?.jobNumber === props.item?.jobNumber)
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipResourcesFromRedux, equipSubcategoryResourcesFromRedux])

  useEffect(() => {

    if (Object.keys(state.equipResourcesByEqId).length > 0 || equipmentSubcategories == null) { return }
    onInit(equipmentSubcategories);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.equipResourcesFilteredByJobNumber, equipResourcesFromRedux, equipmentSubcategories]);


  useEffect(() => {
    state.equipResourcesBySubcategoryForInput.forEach(e => {
      if (e?.qty?.toString() === "") {
        setState(draft => {
          draft.isInputEmpty = true;
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onCheckBoxChange = (eq: Maybe<EquipmentResourceManagementData>, isChecked: boolean) => {
    setState(draft => {
      if (draft.equipResourcesByEqId != null && draft.equipResourcesByEqId[eq?.eqID as number] != null)
        draft.equipResourcesByEqId[eq?.eqID as number].checked = isChecked
      draft.equipResourcesBySubcategory[eq?.eqSubcategoryDescription as string].forEach(e => { if (e.resource?.eqID === eq?.eqID) e.checked = isChecked });
    })

    let _currentIDsList: Array<number> = currentSelectedEqIDs;
    let _eqIDsRed: Array<number> = eqIDsRed;

    //If the check = true, verify if this eqId is already used by another job number. If yes, add to list with job that should be red
    if (isChecked === true) {
      if (!_currentIDsList.includes(eq?.eqID as number) && eq?.jobNumber !== props.item?.jobNumber) {
        _currentIDsList.push(eq?.eqID as number);
        setCurrentSelectedEqIDs(_currentIDsList);
        equipResourcesFromRedux.forEach(erd => {
          if (erd?.eqID === eq?.eqID && !_eqIDsRed.includes(eq?.eqID as number)) _eqIDsRed.push(erd?.eqID as number);
        })
        setEqIDsRed(_eqIDsRed);
      }
      //If the check = false, it means that it was deselected. If it is included in the lists, it should be removed
    } else if (isChecked === false) {
      if (_currentIDsList.includes(eq?.eqID as number)) {
        let index = _currentIDsList.indexOf(eq?.eqID as number);
        _currentIDsList.splice(index, 1);
        setCurrentSelectedEqIDs(_currentIDsList);
        if (_eqIDsRed.includes(eq?.eqID as number)) {
          let index = _eqIDsRed.indexOf(eq?.eqID as number);
          _eqIDsRed.splice(index, 1);
          setEqIDsRed(_eqIDsRed);
        }
      }
    }
  }

  const onInputChange = (equip: Maybe<EquipmentManagementSubCategoryData>, value: string) => {
    let qty: number | "" = parseInt(value);
    qty = isNaN(qty) ? "" : qty;
    if (qty < 0) { return }

    if (qty.toString().length > 2) {
      return;
    }

    setState(draft => {
      draft.equipResourcesBySubcategoryForInput.forEach(e => {
        if (e?.eqSubcategoryDescription === equip?.eqSubcategoryDescription) {
          e!.qty! = qty as number;
          if (e?.qty.toString() === "") {
            draft.isInputEmpty = true;
          }
          else {
            draft.isInputEmpty = false;
          }
        }
      })
    })
  }

  const isButtonDisabled = useCallback(() => {
    if (isDayDisabled === false) {
      if (isJobDisabled === false) {
        if (isGeneral === true) {
          if (state.isInputEmpty === false) {
            return false
          }
          if (props.item?.shift as string != null) {
            return false;
          }
          if (props.item?.shift as string !== "") {
            return false;
          }

        }
      }
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onInit = (equipmentSubcategories: Maybe<EquipmentSubcategories> | undefined, cameFrom?: string) => {
    if (cameFrom != null && cameFrom === "undo") {
      setState(draft => {
        draft.isInputEmpty = false;
      })
    }
    let equipResourcesFilteredByJobNumber = equipResourcesFromRedux.filter(e => e?.jobNumber === props.item?.jobNumber);
    let equipResourcesByEqId = toMap(equipResourcesFilteredByJobNumber ?? [], er => er?.eqID ?? 0);

    let equipSubcategoryResourcesFilteredByJobNumber = equipSubcategoryResourcesFromRedux.filter(e => e?.jobNumber === props.item?.jobNumber);

    let equipSubcategoryResourcesById = toMap(equipSubcategoryResourcesFilteredByJobNumber ?? [], er => er?.eqSubcategoryID as string);

    const res = props.equipmentResources
      .map(er => (
        {
          resource: {
            eqID: er?.eqID,
            eqName: er?.eqName,
            eqSubcategoryDescription: er?.eqSubcategoryDescription,
            eqSubcategoryID: er?.eqSubcategoryID,
            jobName: equipResourcesByEqId[er?.eqID!] != null ? equipResourcesByEqId[er?.eqID!]?.jobName : props.item?.jobName,
            jobNumber: equipResourcesByEqId[er?.eqID!] != null ? equipResourcesByEqId[er?.eqID!]?.jobNumber : props.item?.jobNumber,
            locIndex: equipResourcesByEqId[er?.eqID!] != null ? equipResourcesByEqId[er?.eqID!]?.locIndex : props.item?.locationIndex
          },
          checked: equipResourcesByEqId[er?.eqID!] != null ? true : false
        } as StateResources
      ));

    const _subcategories = props.equipmentResources
      .map(e => ({
        eqSubcategoryID: e?.eqSubcategoryID,
        eqSubcategoryDescription: e?.eqSubcategoryDescription
      }))

    const resInput = _subcategories.map(e => ({
      eqSubcategoryDescription: e?.eqSubcategoryDescription,
      eqSubcategoryID: e.eqSubcategoryID,
      jobName: equipResourcesByEqId[parseInt(e?.eqSubcategoryID!)] != null
        ? equipResourcesByEqId[parseInt(e?.eqSubcategoryID!)]?.jobName
        : props.item?.jobName,
      jobNumber: equipResourcesByEqId[parseInt(e?.eqSubcategoryID!)] != null
        ? equipResourcesByEqId[parseInt(e?.eqSubcategoryID!)]?.jobNumber
        : props.item?.jobNumber,
      locIndex: equipResourcesByEqId[parseInt(e?.eqSubcategoryID!)] != null
        ? equipResourcesByEqId[parseInt(e?.eqSubcategoryID!)]?.locIndex
        : props.item?.locationIndex,
      qty: equipSubcategoryResourcesById[e?.eqSubcategoryID! as string] != null
        ? equipSubcategoryResourcesById[e?.eqSubcategoryID! as string]?.qty
        : 0
    } as EquipmentManagementSubCategoryData
    ));

    let equipmentsForCheckbox = equipmentSubcategories?.equipmentsForCheckbox?.split(",");
    let resourcesForCheckBox: StateResources[] = [];

    for (const equipment of equipmentsForCheckbox!) {
      for (const currentItem of res) {
        if (currentItem.resource?.eqSubcategoryID === equipment) {
          resourcesForCheckBox.push(currentItem);
        }
      }
    }

    let equipmentsForInput = equipmentSubcategories?.equipmentsForInput?.split(",");
    let resourcesForInput: EquipmentManagementSubCategoryData[] = [];

    for (const subcategory of equipmentsForInput!) {
      for (const currentItem of resInput) {
        if (currentItem.eqSubcategoryID === subcategory) {
          resourcesForInput.push(currentItem);
        }
      }
    }

    let equipResourcesBySubcategory = toMultiMap(res, e => e?.resource?.eqSubcategoryDescription as string);

    let _equipResourcesByEqId = toMap(res ?? [], er => er?.resource?.eqID ?? 0)

    let equipResourcesBySubcategoryForCheck = toMultiMap(resourcesForCheckBox, e => e?.resource?.eqSubcategoryDescription as string);

    let equipResourcesBySubcategoryForInput = resourcesForInput.filter((v, i, a) => a.findIndex(t => (t.eqSubcategoryDescription?.trim() === v.eqSubcategoryDescription?.trim())) === i);

    setState(draft => {
      draft.equipResourcesFilteredByJobNumber = equipResourcesFromRedux.filter(e => e?.jobNumber === props.item?.jobNumber);
      draft.equipResourcesBySubcategory = equipResourcesBySubcategory;
      draft.equipResourcesByEqId = _equipResourcesByEqId;
      draft.equipResourcesBySubcategoryForCheck = equipResourcesBySubcategoryForCheck;
      draft.equipResourcesBySubcategoryForInput = equipResourcesBySubcategoryForInput;
    });

    //Populate list that stores eqIDs that belong to more than one job
    equipResourcesFromRedux.forEach(erd => {
      let count = 0;
      equipResourcesFromRedux.forEach(_erd => {
        if (erd?.eqID === _erd?.eqID) count++;
      })
      if (count > 1 && !eqIDsRed.includes(erd?.eqID as number)) {
        let eq = eqIDsRed;
        eq.push(erd?.eqID as number);
        setEqIDsRed(eq);
      }
    })

    //Populate list that stores the current selections
    let _currentIDsList: Array<number> = [];
    Object.values(_equipResourcesByEqId).forEach(res => {
      if (res.checked === true) _currentIDsList.push(res.resource?.eqID as number);
    })
    setCurrentSelectedEqIDs(_currentIDsList);
  }

  const onSave = async () => {
    let equipResources: EquipmentResourceManagementDataInput[] = [];
    let equipResourcesBySubcategory: EquipmentSubcategoryDataInput[] = [];

    Object.values(state.equipResourcesByEqId).forEach(er => {
      if (er.checked === true) {
        equipResources.push({
          eqID: er.resource?.eqID as number,
          eqName: er.resource?.eqName as string,
          eqSubcategoryDescription: er.resource?.eqSubcategoryDescription as string,
          eqSubcategoryID: er.resource?.eqSubcategoryID as string,
          jobNumber: er.resource?.jobNumber == null ? props?.item?.jobNumber as number : er.resource.jobNumber as number,
          jobName: (er.resource?.jobName != null || er.resource?.jobName != null)
            ? er.resource.jobName
            : props.item?.jobName == null ? " "
              : props.item.jobName,
          locIndex: er.resource?.locIndex == null ? props?.item?.locationIndex as number : er.resource?.locIndex as number,
        })
      }
    });

    // save into equipResourcesBySubcategory ony the equipments that have qty higher than 0
    state.equipResourcesBySubcategoryForInput.forEach(eqs => {
      if (eqs?.qty !== 0) {
        equipResourcesBySubcategory.push({
          eqSubcategoryDescription: eqs?.eqSubcategoryDescription?.trim() as string,
          eqSubcategoryID: eqs?.eqSubcategoryID as string,
          jobName: eqs?.jobName as string,
          jobNumber: eqs?.jobNumber as number,
          locIndex: eqs?.locIndex as number,
          qty: eqs?.qty as number,
        })
      }
    })

    let equipAddManagement: AddEquipmentManagementInput = { date: props.item?.date, equipmentResources: equipResources, equipmentSubcategoryData: equipResourcesBySubcategory };
    const [error, response] = await to(addEquipment({
      variables: {
        where: {
          equipmentResourcesToAdd: equipAddManagement,
          date: (moment.utc(props.item?.date).unix()) * 1000,
          jobNumber: props.item?.jobNumber as number,
          isSingleUpdate: state.isSingleUpdate as boolean
        }
      }
    }));

    if (response) {
      let dates: number[] = response?.data?.addEquipment;
      dispatch(updateEquipmentToPavingModule({
        equipmentManagementResources: equipResources,
        equipmentSubcategoryData: equipResourcesBySubcategory,
        dates: dates,
        jobNumber: props.item?.jobNumber as number
      }));
      props.onClose?.();
    }

    if (error) {
      modal?.openModal({
        element: <GeneralWarningModal
          message="Your modifications were not saved. Please refresh and try again."
          title="Error"
          yesNoButtons={false}
        />
      })
    }
  }

  const onUpdateChanges = (checked: boolean) => {
    setState(draft => {
      draft.isSingleUpdate = checked;
    })
  }

  return (
    <div className="Equipment_Resources">
      {loading && <FullScreenLoadingIndicator />}
      <div className="Equipment_Header">
        <div className="Date_Wrap">
          <img src={process.env.PUBLIC_URL + '/gr_logo_rgb.png'} alt="graniterock" />
        </div>
        <CloseButton onClick={props.onClose} />
      </div>
      <div className="middle-content">
        <div className="Header_Information">
          <div className="header_item">{props.item?.jobNumber}</div>
          <div className="header_item">{props.item?.jobName}</div>
          <div className="header_item">{props.item?.shift}</div>
          <div className="header_item">{props.item?.pavingForeman === " " ? "no forman" : props.item?.pavingForeman}</div>
          <div className="header_item">{moment(props.item?.date).utc().format("MM-DD-YY")}</div>
          <div className="header_item">{props.item?.locationIndex as number}</div>
          <div className="header_item">
            Single Update
            <input
              type="checkbox"
              checked={state.isSingleUpdate}
              onChange={(e) => { onUpdateChanges(e.target.checked) }} />
          </div>
        </div>
        <div className="Equipment_Table_Content">
          {
            Object.keys(state.equipResourcesBySubcategoryForCheck)?.map((e) => (
              <Fragment key={e}>
                <div className="Subcategory_Name">{e}</div>
                {
                  state.equipResourcesBySubcategoryForCheck?.[e]
                    .map((resource, index: number) => (
                      <div className="Resource_Line" key={index} data-key={index}>
                        <div className={((eqIDsRed.includes(resource.resource?.eqID as number)) && (currentSelectedEqIDs.includes(resource.resource?.eqID as number))) ? "Resource_Compactors_Red" : "Resource_Compactors"}>
                          {resource?.resource?.eqID}
                        </div>
                        <div className="Resource_SubCategory">
                          {resource?.resource?.eqName as string}
                        </div>
                        <div className="Resource_Check">
                          <CheckBox
                            key={index + resource.resource?.eqID! as number}
                            onChange={(e) => onCheckBoxChange(resource?.resource, e.target.checked)}
                            checked={
                              state.equipResourcesByEqId[resource?.resource?.eqID! as number].checked || false
                            }
                          />
                        </div>
                      </div>
                    ))
                }
              </Fragment>
            ))
          }
          {
            state.equipResourcesBySubcategoryForInput?.map((equip, index) => (
              <div key={index + parseInt(equip?.eqSubcategoryID as string)} className="SubCategory_Input">
                <div className="Subcategory_Name">{equip?.eqSubcategoryDescription?.trim() as string}</div>
                <div className="Subcategory_Qty_Wrapper">
                  <input
                    key={index}
                    value={equip?.qty?.toString() ?? ""}
                    onChange={(e) => { onInputChange(equip, e.target.value) }}
                    className="Subcategory_Qty"
                    style={{ border: equip?.qty?.toString() === "" ? "1px solid red" : "1px solid #000" }}
                  />
                </div>
              </div>
            ))
          }
        </div>
        <div className="Buttons_Wrap">
          <button className="Save" onClick={() => onSave()} disabled={isButtonDisabled() || state.isInputEmpty}>OK</button>
          <div className="Cancel_Buttons_Wrap">
            <button className="Undo" onClick={() => onInit(equipmentSubcategories, "undo")} >Undo</button>
            <button className="Cancel" onClick={() => props.onClose?.()} >Cancel</button>
          </div>
        </div>
      </div>
    </div >
  )
}