import { type ComponentType, useState } from "react";

import { BarChart, type CustomTooltipProps, type EventProps } from "@tremor/react";

import CustomTooltip from "./bar-chart-tooltip";
import {
  type Data,
  type SumData,
  type TransformedData,
  getColors,
  timeFormatter,
} from "./utils";

// Cast CustomTooltip to satisfy tremor's ComponentType<CustomTooltipProps>
// Our tooltip has a compatible but more specific payload type
const CustomTooltipComponent = CustomTooltip as ComponentType<CustomTooltipProps>;

const renameDummyDurationKey = (data: Data[]): TransformedData[] => {
  return data.reduce((acc, { pageNumber, data }) => {
    const transformedItem: Partial<TransformedData> = { pageNumber };

    data.forEach(({ versionNumber, avg_duration }) => {
      transformedItem[`Example time spent per page`] = avg_duration;
    });

    acc.push(transformedItem as TransformedData);
    return acc;
  }, [] as TransformedData[]);
};

const renameSumDurationKey = (data: SumData[], versionNumber?: number) => {
  return data.map((item) => {
    return {
      ...item,
      "Time spent per page": item.sum_duration,
      sum_duration: undefined,
      versionNumber: versionNumber,
    };
  });
};

// Transform data
const transformData = (data: Data[]): TransformedData[] => {
  return data.reduce((acc, { pageNumber, data }) => {
    const transformedItem: Partial<TransformedData> = { pageNumber };

    data.forEach(({ versionNumber, avg_duration }) => {
      transformedItem[`Version ${versionNumber}`] = avg_duration;
    });

    acc.push(transformedItem as TransformedData);
    return acc;
  }, [] as TransformedData[]);
};

const getVersionNumbers = (data: TransformedData[]) => {
  return [
    ...new Set(
      data.flatMap((item) =>
        Object.keys(item).filter((key) => key !== "pageNumber"),
      ),
    ),
  ];
};

export default function BarChartComponent({
  data,
  isSum = false,
  isDummy = false,
  versionNumber,
}: {
  data: Data[] | SumData[];
  isSum?: boolean;
  isDummy?: boolean;
  versionNumber?: number;
}) {
  const [, setValue] = useState<EventProps>(null);

  if (isSum) {
    const renamedData = renameSumDurationKey(data as SumData[], versionNumber);

    return (
      <BarChart
        className="mt-6 rounded-tremor-small"
        data={renamedData}
        index="pageNumber"
        categories={["Time spent per page"]}
        colors={["emerald"]}
        valueFormatter={timeFormatter}
        yAxisWidth={50}
        showGridLines={false}
        onValueChange={(v) => setValue(v)}
        customTooltip={isDummy ? undefined : CustomTooltipComponent}
      />
    );
  }

  let renamedData = transformData(data as Data[]);
  let versionNumbers = getVersionNumbers(renamedData);
  let colors = getColors(versionNumbers);

  if (isDummy) {
    colors = ["gray-300"];
    renamedData = renameDummyDurationKey(data as Data[]);
    versionNumbers = getVersionNumbers(renamedData);
  }

  return (
    <BarChart
      className="mt-6 rounded-tremor-small"
      data={renamedData}
      index="pageNumber"
      categories={versionNumbers}
      colors={colors}
      valueFormatter={timeFormatter}
      yAxisWidth={50}
      showGridLines={false}
      onValueChange={(v) => setValue(v)}
      customTooltip={isDummy ? undefined : CustomTooltipComponent}
    />
  );
}
