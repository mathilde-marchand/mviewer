mviewer.customLayers.joconde = (function () {
  /**
   * Global config
   */
  const proxy = "https://cors-anywhere.herokuapp.com/";

  /**
   * Layers config
   */
  const layerId = "joconde";

  const vectorSource = new ol.source.Vector();

  const clusterSource = new ol.source.Cluster({
    distance: 0,
    source: vectorSource,
  });

  function getStyle(feature) {
    const size = feature.get("features").length;
    return new ol.style.Style({
      image: new ol.style.Circle({
        radius: Math.min(10 + size, 20),
        fill: new ol.style.Fill({ color: "rgba(171, 132, 223, 0.6)" }),
        stroke: new ol.style.Stroke({ color: "white", width: 2 }),
      }),
      text: new ol.style.Text({
        text: size.toString(),
        fill: new ol.style.Fill({ color: "white" }),
        font: "bold 12px sans-serif",
      }),
    });
  }

  const layer = new ol.layer.Vector({
    source: clusterSource,
    style: getStyle,
  });

  new CustomLayer(layerId, layer, {});

  /**
   * Search art by auteur
   */
  async function searchAuteur(auteur) {
    const limit = 100;
    let offset = 0;
    let total = 0;

    // clear the layer from previous data
    vectorSource.clear();

    do {
      const baseUrl = "https://api.pop.culture.gouv.fr/search/simple";

      const params =
        `?text=${auteur}&from=0&size=1000` +
        `&facets[base][0]=joconde` +
        `&facets[base][1]=merimee`;
      // `&facets[authors][0]=${auteur}`;

      // &facets%5Bauthors%5D%5B0%5D=Perret%20Auguste%20(architecte)`;

      // On encode les paramètres pour gérer les espaces et caractères spéciaux
      // const url = proxy + baseUrl + params;
      const url =
        (window.location.hostname === "localhost" ? proxy : "") + baseUrl;
      console.log("url :", url);

      const response = await fetch(url);
      const data = await response.json();

      // console.log("hits :", data.hits);
      console.log("data all :", data);

      total = data.total_count;

      data.hits.forEach((musee) => {
        // console.log(musee);

        if (
          musee._source.POP_COORDONNEES?.lon &&
          musee._source.POP_COORDONNEES?.lat
        ) {
          const feature = new ol.Feature({
            geometry: new ol.geom.Point(
              ol.proj.fromLonLat([
                musee._source.POP_COORDONNEES.lon,
                musee._source.POP_COORDONNEES.lat,
                // musee._associatedNotices[0].notices[0].POP_COORDONNEES.lon,
                // musee._associatedNotices[0].notices[0].POP_COORDONNEES.lat,
              ]),
            ),
            // TODO add props
            // auteur: musee._source.authors,
            // nom_officiel_musee:
            //   musee.nom_officiel_musee.charAt(0).toUpperCase() +
            //   musee.nom_officiel_musee.slice(1),
            // localisation: musee._source.LOCA,
            // titre: musee.titre,
            // appellation: musee.appellation,
            // ville: musee.ville,
            // reference: musee.reference,
          });
          vectorSource.addFeature(feature);
        }
      });

      offset += limit;
    } while (offset < total);
  }

  /**
   * Init search input
   */
  function initSearchInput() {
    let debounceTimer;
    const suggestionsList = document.getElementById("suggestions");
    const input = document.getElementById("search");

    input.addEventListener("input", (e) => {
      const valeur = e.target.value;

      // On annule le timer précédent à chaque nouvelle lettre
      clearTimeout(debounceTimer);

      // Si l'input est trop court, on vide les suggestions
      if (valeur.length < 2) {
        suggestionsList.innerHTML = "";
        return;
      }

      // On lance le timer de 300ms
      debounceTimer = setTimeout(() => {
        getSuggestions(valeur);
      }, 300);
    });

    // recherche avec la touche enter
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        console.log("Recherche keydown enter :", event.target.value);
        searchAuteur(event.target.value);
      }
    });
    initClearInputBtn();
  }

  // TODO récupérer uniquement l'attribut AUTR
  async function getSuggestions(recherche) {
    const baseUrl = "https://api.pop.culture.gouv.fr/search/advanced";

    const bodyQuery = {
      bases: ["joconde", "merimee"],
      crits: [
        {
          crits: [
            {
              base: "joconde",
              fields: "AUTR",
              operator: "*",
              value: recherche,
            },
          ],
        },
        {
          crits: [
            {
              base: "merimee",
              fields: "AUTR",
              operator: "*",
              value: recherche,
            },
          ],
          combinator: "OR",
        },
      ],
      size: 30,
      from: 0,
    };

    try {
      const url =
        (window.location.hostname === "localhost" ? proxy : "") + baseUrl;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyQuery),
      });
      const data = await response.json();
      // console.log(data.hits);
      cleanSuggestions(data.hits, recherche);
    } catch (error) {
      console.error("Erreur getSuggestions :", error);
    }
  }

  function normalizeNoAccent(str) {
    return str
      .normalize("NFD") // décompose les lettres accentuées
      .replace(/[\u0300-\u036f]/g, "") // supprime les accents
      .toLowerCase()
      .trim();
  }

  function cleanSuggestions(hits, recherche) {
    const auteursMap = new Map();

    hits.forEach((hit) => {
      hit._source.authors.forEach((author) => {
        const cleanedAuthor = author.split("(")[0].trim();
        const key = normalizeNoAccent(cleanedAuthor);
        if (
          normalizeNoAccent(cleanedAuthor.toLowerCase()).includes(
            normalizeNoAccent(recherche.toLowerCase()),
          )
        ) {
          if (auteursMap.has(key)) {
            const existing = auteursMap.get(key);
            // si la version existante n'a pas d'accents mais que la nouvelle en a, on remplace
            if (
              normalizeNoAccent(existing) ===
                normalizeNoAccent(cleanedAuthor) &&
              existing !== cleanedAuthor
            ) {
              if (
                existing ===
                existing.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              ) {
                auteursMap.set(key, cleanedAuthor); // garde la version accentuée
              }
            }
          } else {
            auteursMap.set(key, cleanedAuthor);
          }
        }
      });
    });
    const auteursAlph = [...auteursMap.values()].sort((a, b) =>
      a.localeCompare(b),
    );
    // console.log(auteursAlph);
    addSuggestions(auteursAlph);
    // console.log("Résultats authors :", data.hits[0]._source.authors);
    // console.log("Résultats AUTR :", data.hits[0]._source.AUTR);
  }

  function addSuggestions(matches) {
    const input = document.getElementById("search");
    const ul = document.getElementById("suggestions");
    ul.innerHTML = "";
    ul.classList.remove("d-none");

    matches.forEach((match) => {
      const li = document.createElement("li");
      li.className = "list-group-item list-group-item-action";
      li.textContent = match;

      li.addEventListener("click", () => {
        input.value = match;
        ul.innerHTML = "";
        ul.classList.add("d-none");
        console.log("Valeur sélectionnée :", match);
        searchAuteur(match);
      });

      ul.appendChild(li);
    });
  }

  function initClearInputBtn() {
    const btn = document.getElementById("clear-input");
    const ul = document.getElementById("suggestions");
    const input = document.getElementById("search");

    btn.addEventListener("click", () => {
      input.value = "";
      ul.innerHTML = "";
      ul.classList.add("d-none");
      vectorSource.clear();
    });
  }

  const handle = function (clusters, views) {
    if (clusters.length > 0) {
      var l = mviewer.getLayer(layerId);
      var elements = [];
      var html;
      var panel = "";

      clusters.forEach((c) => {
        let featuresProps = c
          ?.getProperties()
          ?.features.map((feature) =>
            feature?.properties
              ? feature.properties || feature
              : feature.getProperties(),
          );

        // Tableau dynamique titres + liens
        let htmlContent = "";

        const clusterFeatures = c?.getProperties()?.features || [];
        const clusterSize = clusterFeatures.length;

        featuresProps
          .sort((a, b) => {
            const titreA = (a.titre || a.appellation || "").toLowerCase();
            const titreB = (b.titre || b.appellation || "").toLowerCase();
            return titreA.localeCompare(titreB, "fr");
          })
          .forEach((props) => {
            const titre = props.titre || props.appellation || "";
            htmlContent += `
              <li>
                <a target="_blank" href="https://pop.culture.gouv.fr/notice/joconde/${props.reference}">
                  ${titre} <i class="ri-external-link-line"></i><br>
                </a>
                <div class="props-auteur">
                  ${props.auteur}
                </div>
              </li>
            `;
          });

        // Agrège les valeurs uniques des propriétés supplémentaires (ADRESSE, DPT, STRUCTURE)
        const datasuppl = ["auteur", "localisation", "ville"].reduce(
          (acc, key) => {
            // Filtre les valeurs nulles et les rend uniques
            const values = c
              ?.getProperties()
              ?.features.map((feature) => feature.getProperties()[key])
              .filter((value) => value != null);
            // Récupère les valeurs uniques. Attention si données pas prop
            //return { ...acc, [key]: [...new Set(values)] };
            // Récupère la 1ère valeur
            return { ...acc, [key]: values[0] || null };
          },
          {},
        );

        // Crée une nouvelle feature avec les coordonnées du cluster et les informations agrégées
        let newFeature = new ol.Feature({
          geometry: new ol.geom.Point(c?.getGeometry().getCoordinates()),
          clusterSize: clusterSize,
          htmlContent,
          ...datasuppl,
        });

        // Ajoute la nouvelle feature au tableau des éléments
        elements.push(newFeature);
      });

      // Génère le contenu HTML pour les informations des clusters
      if (l.template) {
        html = info.templateHTMLContent(elements, l);
      } else {
        html = info.formatHTMLContent(elements, l);
      }

      // Détermine le type de panneau à utiliser en fonction de la configuration mobile ou desktop
      if (configuration.getConfiguration().mobile) {
        panel = "modal-panel";
      } else {
        panel = "right-panel";
      }

      // Récupère la vue associée au panneau
      var view = views[panel];

      // Ajoute une nouvelle couche à la vue avec les informations des clusters
      view.layers.push({
        id: view.layers.length + 1, // Identifiant de la couche
        firstlayer: true, // Indique s'il s'agit de la première couche
        manyfeatures: elements.length > 1, // Indique s'il y a plusieurs features
        nbfeatures: elements.length, // Nombre de features
        name: l.name, // Nom de la couche
        layerid: layerId, // Identifiant de la couche
        theme_icon: l.icon, // Icône du thème
        html: html, // Contenu HTML généré
      });
    }
  };

  /**
   * Init
   */
  async function init() {
    // searchAuteur("Aachen Hans von (d’après)"); // TODO delete*
    // searchAuteur("Perret Auguste (architecte)"); // TODO delete*
    // searchAuteur("Rodin Auguste (1840-1917)"); // TODO delete*

    // allAuteurs = await getAllAuteurs();
    // allAuteurs = cleanAuteurs(allAuteurs);
    // initSearchInput(allAuteurs);
    initSearchInput();

    // getAllAuteursWithCount();
  }

  /**
   * old functions 4 joconde api
   */
  async function getAllAuteurs() {
    const url =
      "https://data.culture.gouv.fr/api/explore/v2.1/catalog/datasets/base-joconde-extrait/records" +
      "?group_by=auteur" +
      "&limit=20000" + // TODO limite à adapter
      '&where=region="Ile-de-France" OR region="Île-de-France" AND auteur IS NOT NULL AND auteur != "anonyme"';

    const baseUrl = "https://api.pop.culture.gouv.fr/search/simple";

    // On laisse 'text' vide pour chercher "tout"
    // On demande la facette 'authors'
    const params =
      `?text=` +
      `&from=0&size=0` + // size=0 car on ne veut pas les notices, juste la liste des auteurs
      `&facets[base][0]=joconde` +
      `&facets[authors][0]=*`; // Le wildcard * tente de tout lister

    // On encode les paramètres pour gérer les espaces et caractères spéciaux
    const url0 = proxy + baseUrl + params;
    console.log("url liste authors:", url0);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Erreur API getAllAuteurs");
    }

    const data = await response.json();
    const auteursSet = new Set();

    data.results.forEach((item) => {
      if (item.auteur) {
        auteursSet.add(item.auteur);
      }
    });

    // console.log(Array.from(auteursSet));
    // console.log(Array.from(auteursSet).length);

    return Array.from(auteursSet);
  }

  async function getAllAuteursWithCount() {
    const url_ =
      "https://data.culture.gouv.fr/api/explore/v2.1/catalog/datasets/base-joconde-extrait/records" +
      "?select=auteur,count(*) as count" +
      "&group_by=auteur" +
      "&limit=20000" +
      '&where=region="Ile-de-France" AND auteur IS NOT NULL AND auteur != "anonyme"';

    const search = "sout";

    const url =
      "https://data.culture.gouv.fr/api/explore/v2.1/catalog/datasets/base-joconde-extrait/records" +
      "?select=auteur,count(*) as count" +
      "&group_by=auteur" +
      "&limit=20000" +
      `&WHERE auteur LIKE "%${search}%"`;

    console.log(url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Erreur API getAllAuteursWithCount");
    }

    const data = await response.json();

    console.log(data.results.length);
    console.log(data.results);

    data.results.forEach((res) => {
      if (res.count > 9999) {
        // console.log(res);
      }
    });
  }

  function cleanAuteurs(auteurs) {
    const auteursMap = new Map();

    auteurs.forEach((auteur) => {
      const items = auteur.includes(";") ? auteur.split(";") : [auteur];

      items.forEach((item) => {
        const value = item.trim();

        if (value === "anonyme") return;

        if (value.includes("'") && !value.includes("après")) {
          // console.log(item);
        }
        // clé normalisée pour la déduplication
        const key = value
          .toLowerCase()
          .normalize("NFD") // enlève les accents
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ");

        // on garde la première version rencontrée
        if (!auteursMap.has(key)) {
          auteursMap.set(key, value);
        }
      });
    });

    return Array.from(auteursMap.values());
  }

  function initSearchInput_(allAuteurs) {
    const auteursLower = allAuteurs.map((a) => a.toLowerCase());

    const input = document.getElementById("search");
    const ul = document.getElementById("suggestions");

    input.addEventListener("input", () => {
      const val = input.value.toLowerCase().trim();
      ul.innerHTML = "";

      // if empty input dont show suggesions
      if (!val) {
        ul.classList.add("d-none");
        return;
      }

      const matches = allAuteurs
        .filter((match, i) => auteursLower[i].includes(val))
        .slice(0, 8);

      // if no matches dont show suggesions
      if (matches.length === 0) {
        ul.classList.add("d-none");
        return;
      }

      matches.forEach((match) => {
        const li = document.createElement("li");
        li.className = "list-group-item list-group-item-action";
        li.textContent = match;

        li.addEventListener("click", () => {
          input.value = match;
          ul.innerHTML = "";
          ul.classList.add("d-none");
          console.log("Valeur sélectionnée :", match);
          searchAuteur(match);
        });

        ul.appendChild(li);
      });

      ul.classList.remove("d-none");
    });

    input.addEventListener("keydown", (event) => {
      // On vérifie si la touche pressée est "Enter"
      if (event.key === "Enter") {
        console.log("Recherche lancée pour :", event.target.value);
        searchAuteur(event.target.value);
      }
    });

    // Fermer les suggestions si clic ailleurs
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".position-relative")) {
        ul.classList.add("d-none");
      }
    });
  }

  return {
    joconde: layerId,
    layer: layer,
    init: init,
    // handle: handle,
  };
})();
