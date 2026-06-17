
// ----------------------
// GLOBAL INSIGHTS
// ----------------------
fetch("./data/global_insights.json")
  .then(res => res.json())
  .then(data => {
    document.getElementById("global").innerHTML = `
      <p>Total Clients: <b>${data.total_clients}</b></p>
      <p>Total Orders: <b>${data.total_orders}</b></p>
      <p>Avg Orders per Client: <b>${data.avg_orders_per_client}</b></p>
      <p>Email Success Rate: <b>${data.email_success_rate?.toFixed(2)}%</b></p>
    `;
  })
  .catch(err => console.error("Global load error:", err));


// ----------------------
// LEADERBOARD
// ----------------------
fetch("./data/leaderboard.json")
  .then(res => res.json())
  .then(data => {
    const table = document.getElementById("leaderboard");

    data
      .sort((a, b) => b.total_orders - a.total_orders)
      .forEach((client, index) => {

        const row = `
          <tr>
            <td>${index + 1}</td>
            <td>${client.client || client.name}</td>
            <td>${client.total_orders}</td>
            <td>${client.email_success || 0}%</td>
          </tr>
        `;

        table.innerHTML += row;
      });
  })
  .catch(err => console.error("Leaderboard load error:", err));
