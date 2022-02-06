
let yearInflation = 0;

let yearPercent = 12;
let yearsToCalculate = 1;
let inputEveryMonth = 80000;

let monthSP500procent = (((yearPercent - yearInflation) / 12) / 100) + 1;
let currentTotal = 0;

let months = 0;
while (months < yearsToCalculate * 12) {
    let newTotal = currentTotal + inputEveryMonth;
    currentTotal = newTotal * monthSP500procent;

    console.log(currentTotal.toLocaleString());
    console.log((currentTotal - newTotal).toLocaleString());
    console.log('==========================================');

    months++;
}

console.log(`${(inputEveryMonth * (yearsToCalculate * 12)).toLocaleString()} - Чисто накопил`);
console.log(`${parseInt(currentTotal).toLocaleString()} - С учетом процентов`);
console.log(`${(parseInt(currentTotal) - (inputEveryMonth * (yearsToCalculate * 12))).toLocaleString()} - Чисто процентами`);