
var sCode="";
function fuckfucktors(fucktors,i,op)
{
    if (!op) { op='+'; }
    var notop = (op=='+') ? '-' : '+';
	if(i!=0)sCode+="[>";
    if(i!=fucktors.length-1) {
        tmpop='+';
    } else {
        tmpop=op;
    }
	for(j=1;j<=fucktors[i];j++)sCode+=tmpop;
	if(i+1<fucktors.length) fuckfucktors(fucktors,i+1,op);
	if(i!=0)sCode+="<-] ";
}

function brainfuckit(string)
{
	//string=document.getElementById("Input").value;
	var aStr=new Array();
	var aStrPrinted= new Array();
	sCode="";
    if (!string) { return ''; }
    if (string.length==0) { return ''; }
	for (i=0;i<string.length;i++) 
	{
		aStr.push(ascii_value(string[i]));
	}
	iMinvalue=aStr.min();
	fucktors=fucktorize(iMinvalue);
	residuo=0;
	if(fucktors.length == 1) 
	{
        fucktors = fucktorize(iMinvalue-1);
        residuo=1;
	}
	fuckfucktors(fucktors,0);
	sCode+=" ";
	for(var i=0;i<(fucktors.length)-1;i++)sCode+=">";
	for(var i=0;i<residuo;i++)sCode+="+";
	for(var i=0;i<aStr.length;i++)
	{
		if(aStr[i]==iMinvalue)
		{
			sCode+=". ";
			continue;
		}
		if(aStr[i]<iMinvalue)
		{
            var x = iMinvalue-aStr[i];
            var ff = fucktorize(x);
            var res=0;
            if((ff.length == 1) && (x!=1))
        	{
                x = x-1;
                ff = fucktorize(x);
                res=1;
        	}
            var maxFucktor = ff.max();
            var complement = x / maxFucktor;
            sCode+='<';
            fuckfucktors([maxFucktor,complement],0,'-');
			sCode+=">";
            for(var k=0;k<res;k++)sCode+="-";
            sCode+=". ";
			iMinvalue-=iMinvalue-aStr[i];
			continue;
		}
		if(aStr[i]>iMinvalue)
		{
            var x = aStr[i]-iMinvalue;
            var ff = fucktorize(x);
            var res=0;
            if((ff.length == 1) && (x!=1))
        	{
                x = x-1;
                ff = fucktorize(x);
                res=1;
        	}
            var maxFucktor = ff.max();
            var complement = x / maxFucktor;
            sCode+='<';
            fuckfucktors([maxFucktor,complement],0,'+');
			sCode+=">";
            for(var k=0;k<res;k++)sCode+="+";
            sCode+=". ";
			iMinvalue+=aStr[i]-iMinvalue;
			continue;
		}
		
	}
	//document.getElementById("Output").value=sCode;
	return sCode;
}

function ascii_value (c)
{
	// restrict input to a single character
	c = c . charAt (0);

	// loop through all possible ASCII values
	var i;
	for (i = 0; i < 256; ++ i)
	{
		// convert i into a 2-digit hex string
		var h = i . toString (16);
		if (h . length == 1)
			h = "0" + h;

		// insert a % character into the string
		h = "%" + h;

		// determine the character represented by the escape code
		h = unescape (h);

		// if the characters match, we've found the ASCII value
		if (h == c)
			break;
	}
	return i;
}

function fucktorize(numm)                      // To calculate the prime fucktors of a number
     {
      if (numm==1) {
        return [1];
      }
      var newnum = numm;                        // Initialise
      var newtext = new Array();
      var checker = 2;                          // First possible factor to check

      while (checker*checker <= newnum)         // See if it is worth looking further for fucktors 
         {      
          if (newnum % checker == 0)            // If the possible factor is indeed a factor...
             { 
              newtext.push(checker);      // ...then record the factor
              newnum = newnum/checker;          //    and divide by it
              if (newnum != 1)                  //    then check whether it is not last...
                 {
                  //newtext = newtext + ".";      //    ...and if so prepare for the next
                 }
             }
          else                                  // otherwise...
             {
              checker++;                        // try the next possible factor
             }
         }
      if (newnum != 1)                          // If there is anything left at the end...
         {                                      // ...this must be the last prime factor
          newtext.push(newnum);           //    so it too should be recorded
         }
      if (newtext == "" + numm)                 // If the only prime factor is the original...
         {
          //newtext = "Prime: " + newtext;        // ...then note that it must have been prime.
         }
      return newtext;                           // Return the prime fucktors
     }

Array.prototype.max = function()
{
var max = Number.MIN_VALUE, v, len = this.length, i = 0;
for (; i < len; ++i)
if (typeof (v = this[i]) == 'number')
max = Math.max(max, v);
return max;
}

Array.prototype.min = function()
{
var min = Number.MAX_VALUE, v, len = this.length, i = 0;
for (; i < len; ++i)
if (typeof (v = this[i]) == 'number')
min = Math.min(min, v);
return min;
}
