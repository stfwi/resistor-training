/**
 * @std ES6
 */
const resistor_trainer = (opts)=>{
  if(!(opts instanceof Object)) opts={};
  const log = (!opts.debug) ? (()=>{}) : console.log;
  if(!opts.delay_ms_on_correct) opts.delay_ms_on_correct = 3000;
  if(!opts.delay_ms_on_incorrect) opts.delay_ms_on_incorrect = 4000;
  if(!opts.no_eseries_match_text) opts.no_eseries_match_text = "&nbsp;";
  // UI elements init
  const container = document.querySelector("div#resistor-training");
  const input_field = container.querySelector("#resistor-training-input");
  const output_field = container.querySelector("#resistor-training-output");
  const output_field_message = container.querySelector("#resistor-training-output-message");
  const output_field_series = container.querySelector("#resistor-training-output-eseries");
  const output_field_alternatives = container.querySelector("#resistor-training-output-alternatives");
  const statistic_num_pass = container.querySelector("#resistor-training-statistics-num-ok");
  const statistic_num_total = container.querySelector("#resistor-training-statistics-num-total");
  const cheat_sheet = container.querySelector("#resistor-training-cheat-sheet");
  const cheat_sheet_link = container.querySelector("#resistor-training-show-cheat-sheet");
  // Constants
  const eng_units = {"P":1e15, "T":1e12, "G":1e9, "M":1e6, "K":1e3, "k":1e3, "m":1e-3, "u":1e-6, "n":1e-9, "p":1e-12, "f":1e-15};
  const e_exponents = [-2,-1,0,1,2,3,4,5,6];
  const e_series = {
    'E3' : { values: [1.0,2.2,4.7], tolerance: 20, exponents:e_exponents }, // >20%
    'E6' : { values: [1.0,1.5,2.2,3.3,4.7,6.8], tolerance: 20, exponents:e_exponents }, // <= 20%
    'E12': { values: [1.0,1.2,1.5,1.8,2.2,2.7,3.3,3.9,4.7,5.6,6.8,8.2], tolerance: 10, exponents:e_exponents }, // <= 10%
    'E24': { values: [1.0,1.1,1.2,1.3,1.5,1.6,1.8,2.0,2.2,2.4,2.7,3.0,3.3,3.6,3.9,4.3,4.7,5.1,5.6,6.2,6.8,7.5,8.2,9.1], tolerance: 5, exponents:e_exponents },  // <= 5%, often also 2%
    'E48': { values: [1.00,1.05,1.10,1.15,1.21,1.27,1.33,1.40,1.47,1.54,1.62,1.69,1.78,1.87,1.96,2.05,2.15,2.26,2.37,2.49,2.61,2.74,2.87,3.01,3.16,3.32,3.48,3.65,3.83,4.02,4.22,4.42,4.64,4.87,5.11,5.36,5.62,5.90,6.19,6.49,6.81,7.15,7.50,7.87,8.25,8.66,9.09,9.53], tolerance: 2, exponents:e_exponents },  // <= 2%
    'E96': { values: [1.00,1.02,1.05,1.07,1.10,1.13,1.15,1.18,1.21,1.24,1.27,1.30,1.33,1.37,1.40,1.43,1.47,1.50,1.54,1,58,1.62,1.65,1.69,1.74,1.78,1.82,1.87,1.91,1.96,2.00,2.05,2.10,2.16,2.21,2.26,2.32,2.37,2.43,2.49,2.55,2.61,2.67,2.74,2.80,2.87,2.94,3.01,3.09,3.16,3.24,3.32,3.40,3.48,3.57,3.65,3.74,3.83,3.92,4.02,4.12,4.22,4.32,4.42,4.53,4.64,4.75,4.87,4.99,5.11,5.23,5.36,5.49,5.62,5.76,5.90,6.04,6.19,6.34,6.49,6.65,6,81,6.98,7.15,7.32,7.50,7.68,7.87,8.06,8.25,8.45,8.66,8.87,9.09,9.31,9.53,9.76], tolerance: 1, exponents:e_exponents },  // <= 1%
  };
  const ring_colors = [
    "#000000","#803300","#d40000","#ff7f24","#f5e600","#008000","#0a0a82","#730873","#777777","#e6e6e6", // digits 0..9 = black..white
    "#acbec2","#f5c933",// silver,gold
    "#00ffcc" // invalid
  ];
  const tolerance_colors = {1:1 ,2:2, 5:11, 10:10}; // tolerance % -> ring_colors index
  const tolerance_colors_min = 1;
  const tolerance_colors_max = 10;
  // Aux functions
  const limit = (x,xmin,xmax)=>((x<=xmin)?(xmin):((x>=xmax)?(xmax):(x)));

  const pick = (obj)=>{
    if(obj.length!==undefined) {
      const index = Math.min(Math.floor(Math.random()*obj.length), obj.length-1);
      return obj[index];
    } else {
      const keys = Object.keys(obj);
      const index = Math.min(Math.floor(Math.random()*keys.length), keys.length-1);
      return obj[keys[index]];
    }
  };

  const e_series_for_value = (value, tolerance)=>{
    let val = Math.round(value/Math.pow(10, Math.floor(Math.log(value)/Math.log(10))) * 100) / 100;
    while(val>=10) val/=10; // correct exp for rounding @ value=1.0eX
    const list = Object.keys(e_series).filter((series_key)=>(e_series[series_key].values.indexOf(val)>=0) && (e_series[series_key].tolerance <= tolerance));
    log("e_series_for_value: val=", val, " list=", list);
    return list;
  };

  const value_representations = (value)=>{
    const list = [];
    if(value<=0) {
      list.push('"Zero-&Omega;"');
    } else if(value >= 1e6) {
      const val = "" + Math.round((value * 1e-6)*1000)/1000;
      list.push(val+"M&Omega;");
      list.push(val+"M");
    } else if(value >= 1e3) {
      const val = "" + Math.round((value * 1e-3)*1000)/1000;
      const k = pick(["K","k"]);
      list.push(val+"K&Omega;");
      list.push(val+k);
      if(val.search(/[,.]/)>=0) list.push(val.replace(/[,.]/,k));
    } else if(value < 1) {
      const val = "" + (value * 1e3);
      list.push(val+"m&Omega;");
    }
    list.push(""+value+"&Omega;");
    return list;
  };

  // Value generators
  const value_generators = {
    // Any values (mostly nonsense)
    "rnd": ()=>{
      const val = limit(Math.floor(Math.random()*1000)+1, 0, 999);
      const exp = limit(Math.floor(Math.random()*8)-2, -2, 6);
      const value = val * Math.pow(10, exp);
      const tolerance = pick(Object.keys(tolerance_colors));
      log("generator.rnd: val=" + val + " exp=" + exp + " --> value=" + value + " tolerance=" + tolerance);
      return {value:value, tolerance:tolerance};
    },
    // E3/E6/E12/E24 (everything with max 2 magnitude digits)
    "e24":()=> {
      const series_name = pick(['E3','E6','E12','E24']);
      const series = e_series[series_name];
      const value = Math.round((pick(series.values) * Math.pow(10, pick(series.exponents))) * 1000) / 1000;
      const tolerance = limit(series.tolerance, 1, 10);
      log("generator.e24: value="+ value, " tolerance="+ tolerance, " series="+ series_name);
      return {value:value, tolerance:tolerance};
    },
    // E3/E6/E12/E24/E48/E96 (everything with max 3 magnitude digits)
    "e96":()=> {
      const series_name = pick(['E3','E6','E12','E24','E48','E96']);
      const series = e_series[series_name];
      const value = Math.round((pick(series.values) * Math.pow(10, pick(series.exponents))) * 1000) / 1000;
      const tolerance = limit(series.tolerance, 1, 10);
      log("generator.e96: value="+ value, " tolerance="+ tolerance, " series="+ series_name);
      return {value:value, tolerance:tolerance};
    }
  }
  // Resistor images
  const resistors = [];
  container.querySelectorAll(".resistor-training-resistor").forEach(svg=>{
    if(!svg.hasAttribute("id")) return;
    const resistor = { node: svg };
    const rings = [];
    // PTH resistor with ring colors
    svg.querySelectorAll("rect,path").forEach(path=>{
      if((!path.hasAttribute("fill")) || ((path.getAttribute("fill").search(/^#0a000[\d]/)) < 0)) return;
      const ring_no = Number.parseInt(path.getAttribute("fill").replace(/^#0a[0]+/, ""));
      while(rings.length < ring_no) rings.push(()=>{});
      rings[ring_no-1] = (val)=>path.setAttribute("fill", ring_colors[(val<0 || val>=ring_colors.length) ? (ring_colors[ring_colors.length-1]) : val]);
    });
    if(Object.keys(rings).length==5) {
      resistor.accepted_generators = ["rnd","e96","e96","e96"]; // also defines random picking weight
      resistor.generate_view = (value, tolerance)=>{
        value = limit(value, 0.01, 999e6);
        tolerance = limit(tolerance, tolerance_colors_min, tolerance_colors_max);
        let exp = limit(Math.floor(Math.log(value)/Math.log(10))-2, -2, 6);
        value = Math.round(value/Math.pow(10, exp));
        while(value>=1000) { exp+=1; value/=10; } // special case 1000e0
        let digits = (""+value).padStart(3, "0").split("").map(n=>Number.parseInt(n));
        digits.push(exp);
        digits.push((tolerance_colors[tolerance]!==undefined) ? tolerance_colors[tolerance] : ring_colors[ring_colors.length-1]);
        let rval = Math.round(((digits[0]*100)+(digits[1]*10)+(digits[2]*1)) * Math.pow(10, digits[3]) * 100) / 100;
        if(digits[3]<0) digits[3] = 9-digits[3];
        for(var i in digits) rings[i](digits[i]);
        log("display.ring5: val=" + value + "e" + exp + " digits=[" + digits + "] return=" + rval);
        return rval;
      };
      resistors.push(resistor);
    } else if(Object.keys(rings).length==4) {
      resistor.accepted_generators = ["rnd","e24","e24","e24","e24"]; // with random picking weight
      resistor.generate_view = (value, tolerance)=>{
        value = limit(value, 0.01, 99e6);
        tolerance = limit(tolerance, tolerance_colors_min, tolerance_colors_max);
        let exp = limit(Math.floor(Math.log(value)/Math.log(10))-1, -2, 6);
        value = Math.round(value/Math.pow(10, exp));
        while(value>=100) { exp+=1; value/=10; } // special case 100e0
        let digits = (""+value).padStart(2, "0").split("").map(n=>Number.parseInt(n));
        digits.push(exp);
        digits.push((tolerance_colors[tolerance]!==undefined) ? tolerance_colors[tolerance] : ring_colors[ring_colors.length-1]);
        let rval = Math.round(((digits[0]*10)+(digits[1]*1)) * Math.pow(10, digits[2]) * 100) / 100;
        if(digits[2]<0) digits[2] = 9-digits[2];
        for(var i in digits) rings[i](digits[i]);
        log("display.ring4: val=" + value + "e" + exp + " digits=[" + digits + "] return=" + rval);
        return rval;
      }
      resistors.push(resistor);
    }
  });

  // UI handling
  const enter_here_placeholder = input_field.getAttribute("placeholder");
  let timout_id = null;

  const reset = ()=>{
    log("--------------------------------------------------------------");
    const resistor = pick(resistors);
    const r_gen = value_generators[pick(resistor.accepted_generators)]();
    const r_shown = resistor.generate_view(r_gen.value, r_gen.tolerance);
    input_field.setAttribute("tag", ""+r_shown+"@"+r_gen.tolerance);
    input_field.value = "";
    if(timout_id) window.clearTimeout(timout_id);
    timout_id = null;
    output_field.style.visibility = "hidden";
    output_field_message.innerHTML = "&nbsp;";
    for(var i=0; i<resistors.length; ++i) {
      resistors[i].node.style.visibility = (resistors[i]==resistor) ? ("visible") : ("hidden");
    }
  };

  const parse = (text)=>{
    text = text.replace(/ohm/ig,"").replace(",", ".").replace(/[^\x00-\x7F]/g, "").replace(/[\s\/\*@%]+/g, " ");
    let value = Number.NaN;
    let tolerance = Number.NaN;
    let m = null;
    if(!!(m=text.match(/^([\d\.PTGMKkmunpf]+)[\s]+([\d]+)$/))) {
      text = m[1];
      tolerance = Number.parseInt(m[2]);
    }
    if(!!(m=text.match(/^([\d\.]+)([PTGMKkmunpf])$/))) {
      value = Number.parseFloat(m[1]) * eng_units[m[2]]; // 4.7k
    } else if(!!(m=text.match(/^([\d]+)([PTGMKkmunpf])([\d]+)$/))) {
      value = Number.parseFloat(""+m[1]+"."+m[3]) * eng_units[m[2]]; // 4k7
    } else {
      value = Number.parseFloat(text); // 4700, 4.7e3 ...
    }
    log("parse: input='" + text + "' parsed=" + value + " tolerance=" + tolerance);
    return {value:value, tolerance:tolerance};
  };

  const check = (input_text)=>{
    input_text = input_text.replace(/^[\s]+/,"").replace(/[\s]+$/,"");
    if(timout_id || (input_text.length==0)) { reset(); return; }
    const entered_value = parse(input_text);
    const val_shown = Number.parseFloat(input_field.getAttribute("tag").split("@")[0]);
    const tol_shown = Number.parseFloat(input_field.getAttribute("tag").split("@")[1]);
    log("check: text='" + entered_value.value + "', shown=" + val_shown);
    statistic_num_total.textContent = Number.parseInt(statistic_num_total.textContent)+1;
    const alternatives = value_representations(val_shown);
    const correct_value = (!alternatives.length) ? (val_shown) : (alternatives[0]);
    if((Math.abs(entered_value.value-val_shown) < 0.01) && (Number.isNaN(entered_value.tolerance) || (entered_value.tolerance==tol_shown))) {
      statistic_num_pass.textContent = Number.parseInt(statistic_num_pass.textContent)+1;
      output_field_message.innerHTML = '<span class="pass">&#10004;' + correct_value + ' /' + tol_shown + '%</span>';
      timout_id = window.setTimeout(reset, opts.delay_ms_on_correct);
    } else {
      output_field_message.innerHTML = '<span class="fail">&#10008; &#9998; ' + correct_value + ' /' + tol_shown + '%</span>';
      timout_id = window.setTimeout(reset, opts.delay_ms_on_incorrect);
    }
    {
      const series = e_series_for_value(val_shown, tol_shown);
      output_field_series.innerHTML = (series.length==0) ? (""+(opts.no_eseries_match_text)) : (series.join(","));
    }
    {
      output_field_alternatives.innerHTML = (!alternatives.length) ? ("&nbsp;") : (alternatives.join(", "));
    }
    output_field.style.visibility = "visible";
    cheat_sheet.style.display = "none";
  };

  container.querySelectorAll("#nojs-warning").forEach(e=>e.parentNode.removeChild(e));
  container.addEventListener("click", ()=>{input_field.focus(); if(output_field.style.visibility =="visible") reset(); });
  input_field.setAttribute("placeholder", enter_here_placeholder);
  input_field.addEventListener("blur", ()=>input_field.setAttribute("placeholder", enter_here_placeholder));
  input_field.addEventListener("focus", ()=>input_field.setAttribute("placeholder", ""));
  input_field.addEventListener("keyup", (ev)=>{if(ev.keyCode==13){ ev.preventDefault(); check(input_field.value); }});
  cheat_sheet_link.addEventListener("click", (ev)=>{ ev.preventDefault(); cheat_sheet.style.display = (cheat_sheet.style.display!="none")?("none"):("block"); });
  reset();
};
