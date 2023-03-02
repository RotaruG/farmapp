import { Button } from "primereact/button";
import { Checkbox, CheckboxChangeParams } from "primereact/checkbox";
import { Dialog } from "primereact/dialog";
import React, { FC, useEffect } from "react";
import { useImmer } from "use-immer";
import { breakdownTypeEnumDescription } from "../../../../entities/enumDescriptions";
import { BreakdownTypeEnum } from "../../../../entities/enums";

interface ICLIModalProps {
    buttonLabel: string;
    visible: boolean;
    isLoading: boolean;
    closeInvoiceModal: (button: string, isClicked?: boolean, selectedCheckboxArray?: BreakdownTypeEnum[]) => void;
}

export const CLIModal: FC<ICLIModalProps> = (props) => {
    const [stateCheckbox, setStateCheckbox] = useImmer({
        ContainerBreakdown: true,
        ReferenceBreakdown: true,
        ChargeBreakdown: true,
        ContainerChargeBreakdown: true,
        selectedCheckboxArray: [
            BreakdownTypeEnum.ChargeBreakdown,
            BreakdownTypeEnum.ContainerBreakdown,
            BreakdownTypeEnum.ContainerChargeBreakdown,
            BreakdownTypeEnum.ReferenceBreakdown
        ] as BreakdownTypeEnum[]
    });

    const handleCheckbox = (type: string, e: CheckboxChangeParams) => {
        setStateCheckbox(stateCheckbox => {
            stateCheckbox[type] = e.checked;
            if (e.checked) {
                stateCheckbox.selectedCheckboxArray.push(BreakdownTypeEnum[type]);
            } else {
                stateCheckbox.selectedCheckboxArray = stateCheckbox.selectedCheckboxArray.filter(item => item !== BreakdownTypeEnum[type]);
            }
        });
    };


    const renderFooter = () => {
        const isDisabled = false;
        const buttonIcon = props.buttonLabel == "Download" ? "icon icon-download icon-white" : "pi pi-eye";
        return (
            <div style={{ textAlign: "center" }}>
                <Button
                    label={props.buttonLabel}
                    icon={`${buttonIcon} ${isDisabled && "icon-disabled icon-white"} `}
                    loading={props.isLoading}
                    loadingIcon="pi pi-spin pi-spinner icon-white"
                    disabled={isDisabled}
                    onClick={() => props.closeInvoiceModal(props.buttonLabel, true, stateCheckbox.selectedCheckboxArray)}
                />
            </div>
        );
    };

    const renderHeader = () => {
        return (
            <div className="flex align-items-center">
                <span className="text-medium-bold text-2xl"></span>
                <Button
                    icon="icon icon-contrast icon-close"
                    className="p-button-text ml-auto p-0 p-w-auto"
                    onClick={() => props.closeInvoiceModal(props.buttonLabel)}
                />
            </div>
        );

    };

    useEffect(() => {
        // Reset the state on close dialog
        setStateCheckbox(stateCheckbox => {
            stateCheckbox.ContainerBreakdown = true;
            stateCheckbox.ReferenceBreakdown = true;
            stateCheckbox.ChargeBreakdown = true;
            stateCheckbox.ContainerChargeBreakdown = true;
            stateCheckbox.selectedCheckboxArray = [
                BreakdownTypeEnum.ChargeBreakdown,
                BreakdownTypeEnum.ContainerBreakdown,
                BreakdownTypeEnum.ContainerChargeBreakdown,
                BreakdownTypeEnum.ReferenceBreakdown
            ];
        });
    }, [props.visible]);

    return (
        <Dialog
            closeOnEscape
            draggable={false}
            modal
            className="p-fluid custom-message-dialog"
            visible={props.visible}
            style={{ width: "100%", maxWidth: 800 }}
            footer={renderFooter()}
            onHide={() => props.closeInvoiceModal(props.buttonLabel)}
            resizable={false}
            header={renderHeader}
            appendTo={document.body}
        >
            <div className="grid border mt-2">
                {/** Reference Breakdown */}
                <div className="col-6 border-bottom border-right py-2 font-bold stripe">
                    Reference Breakdown
                </div>
                <div className="col-6 border-bottom flex align-items-center justify-content-center stripe">
                    <Checkbox
                        checked={stateCheckbox.ReferenceBreakdown}
                        onChange={(e) => handleCheckbox(breakdownTypeEnumDescription[BreakdownTypeEnum.ReferenceBreakdown], e)}
                    ></Checkbox>
                </div>
                {/** Container Breakdown */}
                <div className="col-6 border-bottom border-right py-2 font-bold">
                    Container Breakdown
                </div>
                <div className="col-6 border-bottom flex align-items-center justify-content-center">
                    <Checkbox
                        checked={stateCheckbox.ContainerBreakdown}
                        onChange={(e) => handleCheckbox(breakdownTypeEnumDescription[BreakdownTypeEnum.ContainerBreakdown], e)}
                    ></Checkbox>
                </div>
                {/** Charge Breakdown */}
                <div className="col-6 border-bottom border-right py-2 font-bold stripe">
                    Charge Breakdown
                </div>
                <div className="col-6 border-bottom flex align-items-center justify-content-center stripe">
                    <Checkbox
                        checked={stateCheckbox.ChargeBreakdown}
                        onChange={(e) => handleCheckbox(breakdownTypeEnumDescription[BreakdownTypeEnum.ChargeBreakdown], e)}
                    ></Checkbox>
                </div>
                {/** Container Charge Breakdown */}
                <div className="col-6 border-bottom border-right py-2 font-bold">
                    Container Charge Breakdown
                </div>
                <div className="col-6 border-bottom flex align-items-center justify-content-center">
                    <Checkbox
                        checked={stateCheckbox.ContainerChargeBreakdown}
                        onChange={(e) => handleCheckbox(breakdownTypeEnumDescription[BreakdownTypeEnum.ContainerChargeBreakdown], e)}
                    ></Checkbox>
                </div>
            </div>
        </Dialog>
    );
};