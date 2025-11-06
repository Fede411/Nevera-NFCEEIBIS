export default async function handler(req, res) {
  const { product } = req.query;

  if (!product) {
    return res.status(400).json({ error: "Missing 'product' parameter" });
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          property: "Name",
          title: { equals: product },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Notion query failed: ${errorText}`);
    }

    const queryData = await response.json();

    if (queryData.results.length === 0) {
      return res.status(404).json({ error: `Product '${product}' not found in database` });
    }
    console.log("Using database ID:", process.env.NOTION_DATABASE_ID);

    const page = queryData.results[0];
    const pageId = page.id;
    const currentQty = page.properties.Quantity?.number || 0;
    const price = page.properties.Price?.number || 0;
    const totalConsumed = page.properties["Total Consumed"]?.number || 0;
    const monthlyConsumed = page.properties["Consumed This Month"]?.number || 0;

    const newQty = Math.max(0, currentQty - 1);
    const newTotalConsumed = totalConsumed + 1;
    const newMonthlyConsumed = monthlyConsumed + 1;

    const updateResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          Quantity: { number: newQty },
          "Total Consumed": { number: newTotalConsumed },
          "Consumed This Month": { number: newMonthlyConsumed },
          "Last Consumed": { date: { start: new Date().toISOString() } },
        },
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Notion update failed: ${errorText}`);
    }

    res.status(200).json({
      product,
      oldQty: currentQty,
      newQty,
      totalConsumed: newTotalConsumed,
      monthlyConsumed: newMonthlyConsumed,
      price,
      value: newQty * price,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
