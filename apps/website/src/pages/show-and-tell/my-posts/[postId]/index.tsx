import type { NextPage } from "next";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import { trpc } from "@/utils/trpc";

import Heading from "@/components/content/Heading";
import Meta from "@/components/content/Meta";
import Section from "@/components/content/Section";
import { LoginWithTwitchButton } from "@/components/shared/LoginWithTwitchButton";
import { MessageBox } from "@/components/shared/MessageBox";
import { ShowAndTellEntryForm } from "@/components/show-and-tell/ShowAndTellEntryForm";
import { ShowAndTellNavigation } from "@/components/show-and-tell/ShowAndTellNavigation";

import showAndTellHeader from "@/assets/show-and-tell/header.png";

const EditShowAndTellPage: NextPage = () => {
  const session = useSession();
  const router = useRouter();
  const { postId } = router.query;
  const getMyPost = trpc.showAndTell.getMyEntry.useQuery(String(postId), {
    enabled: Boolean(postId),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  return (
    <>
      <Meta
        title="Edit Post | Show and Tell"
        description="Sign in and edit your previously submitted post, sharing your conservation and wildlife-related activities."
        image={showAndTellHeader.src}
      />

      {/* Nav background */}
      <div className="-mt-40 hidden h-40 bg-alveus-green-900 lg:block" />

      <Section
        dark
        className="py-12"
        containerClassName="flex flex-wrap gap-y-8 gap-x-4 justify-between lg:flex-nowrap"
      >
        <div className="w-full grow lg:w-auto">
          <Heading level={1}>Show and Tell: Edit Post</Heading>
          <p className="text-lg">
            {session?.status === "authenticated" ? "Edit" : "Sign in and edit"}{" "}
            your previously submitted post, sharing your conservation and
            wildlife-related activities.
          </p>
        </div>

        <ShowAndTellNavigation />
      </Section>

      {/* Grow the last section to cover the page */}
      <Section className="grow">
        <Heading level={2}>Your submission</Heading>

        {session?.status !== "authenticated" && (
          <div>
            <p>
              Please log in if you would like to edit or keep track of your
              posts:
            </p>

            <div className="my-4 flex flex-row items-center justify-center">
              <div className="flex-1">
                <LoginWithTwitchButton />
              </div>
            </div>
          </div>
        )}

        {session?.status === "authenticated" && (
          <>
            {getMyPost.isPending && <p>Loading...</p>}
            {getMyPost.isError && (
              <MessageBox variant="failure">
                {getMyPost.error.message}
              </MessageBox>
            )}
            {getMyPost.data && (
              <ShowAndTellEntryForm action="update" entry={getMyPost.data} />
            )}
          </>
        )}
      </Section>
    </>
  );
};

export default EditShowAndTellPage;
