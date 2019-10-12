const fs = require("fs");
const path = require("path");

let arguments = process.argv.slice(2);
if (arguments.length < 1)
  throw "Not enough arguments. Pass Dragon Engine .bin file."

let armpFileName = arguments[0];

let armpFile = fs.readFileSync(armpFileName);
let magic = armpFile.toString('utf8', 0, 4);
if (magic != 'armp') throw('Not the right type of file '+ magic)

let mainTableOffset = armpFile.readInt32LE(0x10);


fs.writeFileSync(armpFileName + ".json", JSON.stringify(parseTable(mainTableOffset), null, 2));
function parseTable(offset) {
    let jsonObject = {};

    let rowCount = armpFile.readInt32LE(offset);
    let columnCount = armpFile.readInt32LE(offset + 4);
    let textCount = armpFile.readInt32LE(offset + 8);
    
    let pointerToRowIDs = armpFile.readInt32LE(offset + 16);
    let pointerToBitsArray1 = armpFile.readInt32LE(offset + 20); //marks rows as valid??
    let pointerToBytesArray1 = armpFile.readInt32LE(offset + 24); //not used
    let pointerToColumnContentOffsets = armpFile.readInt32LE(offset + 28);

    let pointerToTextOffsets = armpFile.readInt32LE(offset + 36);
    let pointerToColumnIDs = armpFile.readInt32LE(offset + 40);

    let pointerToRowOrder = armpFile.readInt32LE(offset + 48); //Row order?
    let pointerToColumnOrder = armpFile.readInt32LE(offset + 52); //Column order?
    let pointerToColumnValidity = armpFile.readInt32LE(offset + 56); //marks columns as valid?
    let pointerToAnotherTable =  armpFile.readInt32LE(offset + 60); //how are they related??
    
    let pointerToColumnTypes = armpFile.readInt32LE(offset + 72);
    let pointerToRowValidity = armpFile.readInt32LE(offset + 76);
    
    let columnTypes = [];
    let textArray = [];
    let rowIDs = [];
    let columnIDs = [];
    let rowOrder = [];
    let columnOrder = [];
    let rowValidity = [];
    let pointersToContent = []; 
    let content= [];

    if (pointerToTextOffsets > 0)
        for (let i = 0; i<textCount; i++)
        {
            let textEnding = armpFile.readInt32LE(pointerToTextOffsets + 4*i);
            while (armpFile[textEnding] != 0x00) textEnding++
            textArray.push(armpFile.toString('utf8', armpFile.readInt32LE(pointerToTextOffsets + 4*i), textEnding))
        }

    if (pointerToRowIDs > 0)
        for (let i = 0; i<rowCount; i++)
        {
            let textEnding = armpFile.readInt32LE(pointerToRowIDs + 4*i);
            while (armpFile[textEnding] != 0x00) textEnding++
            rowIDs.push(armpFile.toString('utf8', armpFile.readInt32LE(pointerToRowIDs + 4*i), textEnding))
        }
    
    if (pointerToColumnIDs > 0)
        for (let i = 0; i<columnCount; i++)
        {
            let textEnding = armpFile.readInt32LE(pointerToColumnIDs + 4*i);
            while (armpFile[textEnding] != 0x00) textEnding++
            columnIDs.push(armpFile.toString('utf8', armpFile.readInt32LE(pointerToColumnIDs + 4*i), textEnding))
        }

    if (pointerToRowOrder > 0)
    {
        for (let i = 0; i<rowCount; i++) 
            rowOrder.push(armpFile.readInt32LE(pointerToRowOrder + 4*i))
    }    

    for (let i = 0; i<rowCount; i++)
    {
        //safeguard in case order doesn't have one or more of the items
        if (rowOrder.indexOf(i) == -1) rowOrder.push(i);
    }

    if (pointerToColumnOrder > 0)
        for (let i = 0; i<columnCount; i++) 
            columnOrder.push(armpFile.readInt32LE(pointerToColumnOrder + 4*i))

    for (let i = 0; i<columnCount; i++)
    {
        //safeguard in case order doesn't have one or more of the items
        if (columnOrder.indexOf(i) == -1) columnOrder.push(i);
    }

    if (pointerToColumnTypes > 0)
        for (let i = 0; i<columnCount; i++) 
            columnTypes.push(armpFile.readInt8(pointerToColumnTypes + i));
    
    if (pointerToColumnValidity > 0)
    {
        columnValidity = decBin(armpFile.readInt32LE(pointerToColumnValidity), columnCount);
        jsonObject.columnValidity = {};
        for (let i = 0; i<columnCount; i++) {
            let columnName = i+". "+columnIDs[i];
            if (columnIDs[i] == undefined) columnName = i
            jsonObject.columnValidity[columnName] = columnValidity[i];
        }
    }

    if (pointerToRowValidity > 0)
    {
        for (let i = 0; i<rowCount; i++) {
           rowValidity.push(armpFile.readInt8(pointerToRowValidity + i).toString(2));
        }
    }

    if (pointerToColumnContentOffsets > 0)
    {
        for (let column = 0; column<columnCount; column++)
        {
            content[column] = []
            let bitArray = "";
            pointersToContent.push(armpFile.readInt32LE(pointerToColumnContentOffsets + 4*column));
            if (pointersToContent[column] > 0)
                if (columnTypes[column] == 0)
                    for (let row = 0; row<rowCount; row++)
                        content[column][row] = armpFile.readInt8(pointersToContent[column] + row);
                if ((columnTypes[column] == 1)||(columnTypes[column] == 5))
                    for (let row = 0; row<rowCount; row++)
                        content[column][row] = armpFile.readInt16LE(pointersToContent[column] + 2*row);
                if ((columnTypes[column] == 2)||(columnTypes[column] == 3)||(columnTypes[column] == 4)||(columnTypes[column] == 6))
                    for (let row = 0; row<rowCount; row++)
                        content[column][row] = armpFile.readInt32LE(pointersToContent[column] + 4*row);
                if (columnTypes[column] == 7)
                    for (let row = 0; row<rowCount; row++)
                        content[column][row] = armpFile.readInt32LE(pointersToContent[column] + 8*row);
                if (columnTypes[column] == 9)
                    for (let row = 0; row<rowCount; row++)
                        content[column][row] = armpFile.readFloatLE(pointersToContent[column] + 4*row);
                if (columnTypes[column] == 11)
                {
                    bitArray = decBin(armpFile.readInt32LE(pointersToContent[column]), rowCount);
                    for (let row = 0; row<rowCount; row++)
                        content[column][row] = bitArray[row];
                }
                if (columnTypes[column] == 12)
                    for (let row = 0; row<rowCount; row++)
                        content[column][row] = textArray[armpFile.readInt32LE(pointersToContent[column] + 4*row)];

                if (columnTypes[column] == 13)
                    for (let row = 0; row<rowCount; row++)
                        if (armpFile.readInt32LE(pointersToContent[column] + 8*row)>0)
                            content[column][row] = parseTable(armpFile.readInt32LE(pointersToContent[column] + 8*row));
                
        }
    }


    jsonObject.columnTypes = {};
    for (let i = 0; i<columnCount; i++) {
        let columnName = i+". "+columnIDs[i];
        if (columnIDs[i] == undefined) columnName = i
        jsonObject.columnTypes[columnName] = columnTypes[i];
    }


    for (let row = 0; row<rowCount; row++) {
        let rowName = row;
        if (row != rowOrder[row]) rowName += "("+rowOrder[row]+")";
        if (rowIDs[row] != undefined) rowName += ". "+rowIDs[row];

        jsonObject[rowName] = {};
        
        for (let column = 0; column<columnCount; column++)
        {       
                let columnName = column;
                //if (column != columnOrder[column]) columnName += "("+columnOrder[column]+")";
                if (columnIDs[column] != undefined) columnName += ". "+columnIDs[column];
                jsonObject[rowName][columnName] = content[column][row]; 
        }

        if(rowValidity[row] != undefined) jsonObject[rowName]['validityBool'] = rowValidity[row]
    }

    
    if (pointerToBitsArray1 != -1) jsonObject.bitArray = armpFile[pointerToBitsArray1].toString(2);

    // Subtable
    if (pointerToAnotherTable != 0) jsonObject.subTable = parseTable(pointerToAnotherTable);

    return jsonObject;

}


function decBin(dec,length){
    let out = "";
    while(length--)
      out += (dec >> length ) & 1;    
    return out;  
  }
