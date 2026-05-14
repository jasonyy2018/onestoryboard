import { db } from "../src/lib/db";

async function calculateAverages() {
  const projects = await db.project.findMany({
    include: {
      _count: {
        select: {
          characters: true,
          scenes: true,
        }
      },
      scenes: {
        include: {
          _count: {
            select: {
              props: true,
              shots: true,
            }
          }
        }
      }
    }
  });

  if (projects.length === 0) {
    console.log("No projects found.");
    return;
  }

  let totalEpisodes = 0;
  let totalCharacters = 0;
  let totalScenes = 0;
  let totalProps = 0;
  let totalShots = 0;

  for (const project of projects) {
    const episodes = project.episodeCount || 1;
    totalEpisodes += episodes;
    totalCharacters += project._count.characters;
    totalScenes += project._count.scenes;
    
    for (const scene of project.scenes) {
      totalProps += scene._count.props;
      totalShots += scene._count.shots;
    }
  }

  console.log("--- Pipeline Statistics ---");
  console.log(`Total Projects: ${projects.length}`);
  console.log(`Total Episodes: ${totalEpisodes}`);
  console.log(`Average Characters per Episode: ${(totalCharacters / totalEpisodes).toFixed(2)}`);
  console.log(`Average Scenes per Episode: ${(totalScenes / totalEpisodes).toFixed(2)}`);
  console.log(`Average Props per Episode: ${(totalProps / totalEpisodes).toFixed(2)}`);
  console.log(`Average Shots (Videos) per Episode: ${(totalShots / totalEpisodes).toFixed(2)}`);
  console.log("---------------------------");
}

calculateAverages()
  .catch(console.error)
  .finally(() => process.exit());
