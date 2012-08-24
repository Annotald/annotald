<html>
  <head>
    <title>Annotald Plots</title>
  </head>
  <body>
    <div id="controls">
      <form action="/plots" method="post">
        <select name="plottype">
%for plot in plottypes:
<option value="${plot}">${plot}</option>
%endfor
        </select>
        Start date (YYYY-MM-DD): <input type="text" name="startdate" value="${startdate}">
        End date (YYYY-MM-DD): <input type="text" name="enddate" value="${enddate}">
        <input type="submit">
      </form>
    </div>
    <div id="plots">
%for plot in plots:
      <div class="plot">
        ${plot}
      </div>
%endfor
    </div>
  </body>
</html>
