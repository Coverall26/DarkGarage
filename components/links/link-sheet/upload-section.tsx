import { useEffect, useState } from "react";

import { DEFAULT_LINK_TYPE } from ".";
import LinkItem from "./link-item";
import { LinkUpgradeOptions } from "./link-options";

export default function UploadSection({
  data,
  setData,
  isAllowed,
  handleUpgradeStateChange,
}: {
  data: DEFAULT_LINK_TYPE;
  setData: React.Dispatch<React.SetStateAction<DEFAULT_LINK_TYPE>>;
  isAllowed: boolean;
  handleUpgradeStateChange: ({
    state,
    trigger,
    plan,
  }: LinkUpgradeOptions) => void;
  targetId?: string;
}) {
  const { enableUpload } = data;
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    setEnabled(enableUpload ?? false);
  }, [enableUpload]);

  const handleEnableUpload = () => {
    const updatedEnableUpload = !enabled;
    setData({ ...data, enableUpload: updatedEnableUpload });
    setEnabled(updatedEnableUpload);
  };

  return (
    <div className="pb-5">
      <LinkItem
        title="Allow file uploads"
        enabled={enabled}
        link="https://www.fundroom.ai/help/link-settings"
        action={handleEnableUpload}
        isAllowed={isAllowed}
        requiredPlan="data rooms plus"
        upgradeAction={() =>
          handleUpgradeStateChange({
            state: true,
            trigger: "link_sheet_upload_section",
            plan: "Data Rooms Plus",
          })
        }
        tooltipContent="Allow visitors to upload files to the dataroom."
      />
    </div>
  );
}
