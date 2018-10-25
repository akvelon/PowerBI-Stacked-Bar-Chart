module powerbi.extensibility.visual.visualUtils {
    import IAxisProperties = powerbi.extensibility.utils.chart.axis.IAxisProperties;
    import TextMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;
    import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;

    const DisplayUnitValue: number = 1;

    export function calculateBarCoordianates(data: VisualData, settings: VisualSettings, barHeight: number): void {
        let isCategoricalAxisType: boolean = settings.categoryAxis.axisType === "categorical";

        data.dataPoints.forEach(point => {
            let height, width, x, y: number;

            if (data.axes.yIsScalar && !isCategoricalAxisType) {
                let start = settings.categoryAxis.start;

                height = start != null && start > point.category || barHeight < 0 ? 0 : barHeight;
            } else {
                height = data.axes.y.scale.rangeBand();
            }

            let xValue = point.shiftValue < data.axes.x.dataDomain[0] ? data.axes.x.dataDomain[0] : point.shiftValue;
            if (xValue) {
                x = data.axes.x.scale(xValue);
            } else {
                let xValue = 0;
                if (data.axes.x.dataDomain[0] > 0) {
                    xValue = data.axes.x.dataDomain[0];
                }
                x = data.axes.x.scale(xValue);
            }
            if ( x >= data.size.width ){
                point.barCoordinates = {
                    height: 0,
                    width: 0,
                    x: 0,
                    y: 0
                };
                return;
            }

            let widthValue: number = point.valueForWidth as number;
            if (data.axes.x.scale(widthValue + point.shiftValue) < 0) {
                width = 0;
            } else {
                let end = settings.valueAxis.end;
                let valueToScale = widthValue + point.shiftValue;

                width = data.axes.x.scale(end != null && valueToScale > end ? end : valueToScale) - data.axes.x.scale(xValue);
            }

            if (data.axes.yIsScalar && !isCategoricalAxisType) {
                y = data.axes.y.scale(point.category) - barHeight / 2;
            } else {
                y = data.axes.y.scale(point.category);
            }

            point.barCoordinates = {
                height: height,
                width: width < 1 && width !== 0 ? 1 : width,
                x: x,
                y: y
            };
        });

        if (data.axes.yIsScalar && settings.categoryAxis.axisType !== "categorical") {
            this.recalculateHeightForContinuous(data, barHeight);
        }
    }

    export function recalculateHeightForContinuous(data: VisualData, barHeight: number) {
        let minHeight: number = 1.5,
            minDistance: number = Number.MAX_VALUE;

        let dataPoints: VisualDataPoint[] = data.dataPoints.sort((a, b) => {
            return a.barCoordinates.y - b.barCoordinates.y;
        });

        let firstDataPoint: VisualDataPoint = dataPoints[0];

        for (let i = 1; i < dataPoints.length; ++i) {
            let distance: number = dataPoints[i].barCoordinates.y - firstDataPoint.barCoordinates.y;

            minDistance = distance < minDistance ? distance : minDistance;
            firstDataPoint = dataPoints[i];
        }

        if (minDistance < minHeight) {
            
        } else if (minHeight < minDistance && minDistance < barHeight) {
            minHeight = minDistance;
        } else {
            minHeight = barHeight;
        }

        if (barHeight && barHeight !== minHeight) {
            dataPoints.forEach(x => {
                x.barCoordinates.height = x.barCoordinates.height ? minHeight : 0;
                x.barCoordinates.y = x.barCoordinates.y + barHeight / 2;
            });
        }
    }

    export function calculateLabelCoordinates(data: VisualData,
                                            settings: categoryLabelsSettings,
                                            metadata: VisualMeasureMetadata,
                                            chartWidth: number,
                                            isLegendRendered: boolean) {
        if (!settings.show) {
            return;
        }

        let dataPointsArray: VisualDataPoint[] = data.dataPoints;

        let dataLabelFormatter: IValueFormatter = formattingUtils.createFormatter(settings.displayUnits,
                                                                        settings.precision,
                                                                        metadata.cols.value,
                                                                        formattingUtils.getValueForFormatter(data));

        let textPropertiesForWidth: TextProperties = formattingUtils.getTextProperties(settings);
        let textPropertiesForHeight: TextProperties = formattingUtils.getTextPropertiesForHeightCalculation(settings);

        dataPointsArray.forEach(dataPoint => {
            let formattedText: string = dataLabelFormatter.format(dataPoint.value);
            textPropertiesForHeight.text = formattedText;

            let textWidth: number = TextMeasurementService.measureSvgTextWidth(textPropertiesForWidth, formattedText);
            let textHeight: number = TextMeasurementService.estimateSvgTextHeight(textPropertiesForHeight);

            let barHeight: number = dataPoint.barCoordinates.height;

            if (settings.overflowText || textHeight +
                (settings.showBackground ? DataLabelHelper.labelBackgroundHeightPadding : 0) < barHeight) {
                let dy: number = dataPoint.barCoordinates.y + dataPoint.barCoordinates.height / 2 + (textHeight - 3) / 2,
                dx: number = DataLabelHelper.calculatePositionShift(settings, textWidth, dataPoint, chartWidth, isLegendRendered);

                if (dx !== null) {
                    dataPoint.labelCoordinates = {
                        x: dx,
                        y: dy,
                        width: textWidth,
                        height: textHeight
                    };
                } else {
                    dataPoint.labelCoordinates = null;
                }
            } else {
                dataPoint.labelCoordinates = null;
            }
        });
    }

    export function getNumberOfValues(dataView: DataView): number {
        const columns: DataViewMetadataColumn[] = dataView.metadata.columns;
        let valueFieldsCount: number = 0;

        for (let columnName in columns) {
            const column: DataViewMetadataColumn = columns[columnName];

            if (column.roles && column.roles[Field.Value]) {
                ++valueFieldsCount;
            }
        }

        return valueFieldsCount;
    }

    export function getLineStyleParam(lineStyle) {
        let strokeDasharray;

        switch (lineStyle) {
            case "solid":
                strokeDasharray = "none";
                break;
            case "dashed":
                strokeDasharray = "7, 5";
                break;
            case "dotted":
                strokeDasharray = "2, 2";
                break;
        }

        return strokeDasharray;
    }

    export function getUnitType(xAxis: IAxisProperties): string {
        if (xAxis.formatter
            && xAxis.formatter.displayUnit
            && xAxis.formatter.displayUnit.value > DisplayUnitValue) {

            return xAxis.formatter.displayUnit.title;
        }

        return null;
    }

    export function getTitleWithUnitType(title, axisStyle, axis: IAxisProperties): string {
        let unitTitle = visualUtils.getUnitType(axis) || "No unit";
        switch (axisStyle) {
            case "showUnitOnly": {
                return unitTitle;
            }
            case "showTitleOnly": {
                return title;
            }
            case "showBoth": {
                return `${title} (${unitTitle})`;
            }
        }
    }

    export const DimmedOpacity: number = 0.4;
    export const DefaultOpacity: number = 1.0;

    export function getFillOpacity(selected: boolean, highlight: boolean, hasSelection: boolean, hasPartialHighlights: boolean): number {
        if ((hasPartialHighlights && !highlight) || (hasSelection && !selected)) {
            return DimmedOpacity;
        }

        return DefaultOpacity;
    }

    const CategoryMinHeight: number = 16;
    const CategoryMaxHeight: number = 130;
    const CategoryContinuousMinHeight: number = 1;

    export function calculateBarHeight(
        visualDataPoints: VisualDataPoint[],
        visualSize: ISize,
        categories: string[],
        categoryInnerPadding: number,
        yScale: any,
        settings: VisualSettings,
        ): number {

        let currentBarHeight = visualSize.height / categories.length;
        let barHeight: number = 0;

        if (settings.categoryAxis.axisType === "categorical") {
            let innerPadding: number = categoryInnerPadding / 100;
            barHeight = d3.min([CategoryMaxHeight, d3.max([CategoryMinHeight, currentBarHeight])]) * (1 - innerPadding);
        } else {
            let dataPoints = [...visualDataPoints];

            let start = settings.categoryAxis.start,
                end = settings.categoryAxis.end;

            if (start != null || end != null) {
                dataPoints = dataPoints.filter(x => start != null ? x.value >= start : true 
                                                &&  end != null ? x.value <= end : true)
            }

            let dataPointsCount: number = dataPoints.length;

            if (dataPointsCount < 4) {
                let devider: number = 3.75;
                barHeight = visualSize.height / devider;
            } else {
                let devider: number = 3.75 + 1.25 * (dataPointsCount - 3); 
                barHeight = visualSize.height / devider;
            }
        }

        return barHeight;
    }

    export function getLabelsMaxWidth(group: d3.selection.Group): number {
        const widths: Array<number> = [];

        group.forEach((item: any) => {
            let dimension: ClientRect = item.getBoundingClientRect();
            widths.push(d3.max([dimension.width, dimension.height]));
        });

        if (group.length === 0) {
            widths.push(0);
        }

        return d3.max(widths);
    }

    export function getLabelsMaxHeight(group: d3.selection.Group): number {
        const heights: Array<number> = [];

        group.forEach((item: any) => {
            let dimension: ClientRect = item.getBoundingClientRect();
            heights.push(dimension.height);
        });

        if (group.length === 0) {
            heights.push(0);
        }

        return d3.max(heights);
    }

    export function GetYAxisTitleHeight(valueSettings: valueAxisSettings): number {

        let textPropertiesForHeight: TextProperties = {
            fontFamily: valueSettings.titleFontFamily,
            fontSize: valueSettings.titleFontSize.toString()
        };

        return TextMeasurementService.estimateSvgTextHeight(textPropertiesForHeight);
    }

    export function GetXAxisTitleHeight(categorySettings: categoryAxisSettings): number {

        let textPropertiesForHeight: TextProperties = {
            fontFamily: categorySettings.titleFontFamily,
            fontSize: categorySettings.titleFontSize.toString()
        };

        return TextMeasurementService.estimateSvgTextHeight(textPropertiesForHeight);
    }

    export function isSelected(selected: boolean, highlight: boolean, hasSelection: boolean, hasPartialHighlights: boolean): boolean {
        return !(hasPartialHighlights && !highlight || hasSelection && !selected);
    }

    export function compareObjects(obj1: any[], obj2: any[], property: string): boolean {
        let isEqual: boolean = false;

        if (obj1.length > 0 && obj2.length > 0 && obj1.length === obj2.length) {
            isEqual = true;
            obj1.forEach((o1, i) => {
                obj2.forEach((o2, j) => {
                    if (i === j) {
                        isEqual = isEqual && o1[property] === o2[property];
                    }
                });
            });
        } else if (obj1.length === 0 && obj2.length === 0) {
            isEqual = true;
        }

        return isEqual;
    }
}