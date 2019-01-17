module powerbi.extensibility.visual.visualUtils {
    import IAxisProperties = powerbi.extensibility.utils.chart.axis.IAxisProperties;
    import TextMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;
    import TextProperties = powerbi.extensibility.utils.formatting.TextProperties;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import axis = powerbi.extensibility.utils.chart.axis;
    import valueType = powerbi.extensibility.utils.type.ValueType;

    const DisplayUnitValue: number = 1;

    export function calculateBarCoordianatesByData(data: VisualData, settings: VisualSettings, barHeight: number, isSmallMultiple: boolean = false): void {
        let dataPoints: VisualDataPoint[] = data.dataPoints;
        let axes: IAxes = data.axes;

        this.calculateBarCoordianates(dataPoints, axes, settings, barHeight, isSmallMultiple);
    }

    export function calculateBarCoordianates(dataPoints: VisualDataPoint[], axes: IAxes, settings: VisualSettings, barHeight: number, isSmallMultiple: boolean = false): void {
        let isCategoricalAxisType: boolean = settings.categoryAxis.axisType === "categorical";
        const skipCategoryStartEnd: boolean = isSmallMultiple && settings.categoryAxis.rangeType !== AxisRangeType.Custom,
            skipValueStartEnd: boolean = isSmallMultiple && settings.valueAxis.rangeType !== AxisRangeType.Custom;

        dataPoints.forEach(point => {
            let height, width, x, y: number;

            if (!axes.yIsScalar || isCategoricalAxisType) {
                height = axes.y.scale.rangeBand();
            } else {
                height = dataPoints.length > 2 ? barHeight * 0.8 : barHeight / 2 * 0.8;
            }

            let xValue = point.shiftValue < axes.x.dataDomain[0] ? axes.x.dataDomain[0] : point.shiftValue;
            if (xValue) {
                x = axes.x.scale(xValue);
            } else {
                let xValue = axes.x.dataDomain[0] > 0 ? axes.x.dataDomain[0] : 0;
                x = axes.x.scale(xValue);
            }

            let widthValue: number = point.valueForWidth as number;
            if (point.shiftValue > axes.x.dataDomain[1]) {
                width = 0;
            } else if (point.shiftValue + widthValue < axes.x.dataDomain[0]) {
                width = 0;
            } else if (axes.x.scale(widthValue + point.shiftValue) <= 0) {
                width = 1;
            } else {
                let end = skipValueStartEnd ? null : settings.valueAxis.end;

                let valueToScale = widthValue + point.shiftValue;

                width = axes.x.scale(end != null && valueToScale > end ? end : valueToScale) - axes.x.scale(xValue);
            }

            y = axes.y.scale(point.category);

            point.barCoordinates = {
                height: height,
                width: width < 1 && width !== 0 ? 1 : width,
                x: x,
                y: y
            };
        });

        if (axes.yIsScalar && settings.categoryAxis.axisType !== "categorical") {
            this.recalculateHeightForContinuous(dataPoints, skipCategoryStartEnd, settings.categoryAxis, barHeight);
        }
    }

    export function recalculateHeightForContinuous(dataPoints: VisualDataPoint[], skipCategoryStartEnd: boolean, categorySettings: categoryAxisSettings, startHeight: number) {
        let minHeight: number = 1.5,
            minDistance: number = Number.MAX_VALUE;

        let start = skipCategoryStartEnd ? null : categorySettings.start,
            end = skipCategoryStartEnd ? null : categorySettings.end;

        let dataPointsSorted: VisualDataPoint[] = dataPoints.sort((a, b) => {
            return a.barCoordinates.y - b.barCoordinates.y;
        });

        let sortedBarCoordinates: number[] = dataPointsSorted.map(d => d.barCoordinates.y).filter((v, i, a) => a.indexOf(v) === i);

        let firstCoodinate: number = sortedBarCoordinates[0];

        for (let i = 1; i < sortedBarCoordinates.length; ++i) {
            let distance: number = sortedBarCoordinates[i] - firstCoodinate;

            minDistance = distance < minDistance ? distance : minDistance;
            firstCoodinate = sortedBarCoordinates[i];
        }

        if (minDistance < minHeight) {
            
        } else if (minHeight < minDistance) {
            minHeight = minDistance;
        }
        
        dataPointsSorted.forEach(d => {
            let height: number = 0;
            if (startHeight > minHeight) {
                let padding: number = minHeight / 100 * 20;
                height = minHeight - padding;
            } else {
                height = d.barCoordinates.height;
            }

            height = start != null && start > d.category || height < 0 ? 0 : height;
            height = end != null && end <= d.category ? 0 : height;

            d.barCoordinates.height = height;
            
            d.barCoordinates.y = d.barCoordinates.y - d.barCoordinates.height / 2;
        });        
    }

    export function calculateLabelCoordinates(data: VisualData,
                                            settings: categoryLabelsSettings,
                                            metadata: VisualMeasureMetadata,
                                            chartWidth: number,
                                            isLegendRendered: boolean,
                                            dataPoints: VisualDataPoint[] = null) {
        if (!settings.show) {
            return;
        }

        let dataPointsArray: VisualDataPoint[] = dataPoints || data.dataPoints;

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

    export function calculateBarHeight(
        visualDataPoints: VisualDataPoint[],
        visualSize: ISize,
        categoriesCount: number,
        categoryInnerPadding: number,
        settings: VisualSettings,
        isSmallMultiple: boolean = false): number {

        let currentBarHeight = visualSize.height / categoriesCount;
        let barHeight: number = 0;

        if (settings.categoryAxis.axisType === "categorical") {
            let innerPadding: number = categoryInnerPadding / 100;
            barHeight = d3.min([CategoryMaxHeight, d3.max([CategoryMinHeight, currentBarHeight])]) * (1 - innerPadding);
        } else {
            let dataPoints = [...visualDataPoints];

            const skipStartEnd: boolean = isSmallMultiple && settings.categoryAxis.rangeType !== AxisRangeType.Custom;

            let start = skipStartEnd ? null : settings.categoryAxis.start,
                end = skipStartEnd ? null : settings.categoryAxis.end;

            if (start != null || end != null) {
                dataPoints = dataPoints.filter(x => start != null ? x.value >= start : true 
                                                &&  end != null ? x.value <= end : true)
            }

            let dataPointsCount: number = dataPoints.map(x => x.category).filter((v, i, a) => a.indexOf(v) === i).length;

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

    export function GetYAxisTitleThickness(valueSettings: valueAxisSettings): number {

        let textPropertiesForHeight: TextProperties = {
            fontFamily: valueSettings.titleFontFamily,
            fontSize: valueSettings.titleFontSize.toString()
        };

        return TextMeasurementService.estimateSvgTextHeight(textPropertiesForHeight);
    }

    export function GetXAxisTitleThickness(categorySettings: categoryAxisSettings): number {

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

    export function categoryIsScalar(metadata: VisualMeasureMetadata): boolean {
        const categoryType: valueType = axis.getCategoryValueType(metadata.cols.category);
        let isOrdinal: boolean = axis.isOrdinal(categoryType);

        return !isOrdinal;
    }
}